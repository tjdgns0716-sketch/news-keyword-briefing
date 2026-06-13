import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_JSON = path.join(ROOT_DIR, "data", "latest.json");
const GENERATOR = path.join(ROOT_DIR, "scripts", "generate-briefing.mjs");
const DEFAULT_PORT = Number(process.env.PORT ?? 4173);
const STARTUP_STALE_MINUTES = Number(process.env.STARTUP_STALE_MINUTES ?? 12 * 60);

const staticFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/data/latest.js", path.join("data", "latest.js")],
  ["/data/latest.json", path.join("data", "latest.json")],
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const generation = {
  running: false,
  reason: null,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  lastOutput: "",
  nextScheduledAt: null,
};

let scheduledTimer = null;

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendText(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(value);
}

async function serveStatic(requestPath, response) {
  const relativePath = staticFiles.get(requestPath);
  if (!relativePath) {
    sendText(response, 404, "Not found");
    return;
  }

  const filePath = path.join(ROOT_DIR, relativePath);
  const extension = path.extname(filePath);
  const body = await readFile(filePath);

  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    "Cache-Control": requestPath.startsWith("/data/") ? "no-store" : "no-cache",
  });
  response.end(body);
}

async function readBriefing() {
  return JSON.parse(await readFile(DATA_JSON, "utf8"));
}

function getKstParts(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  };
}

function fromKstParts(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0));
}

function toKstIso(date) {
  const value = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hour = String(value.getUTCHours()).padStart(2, "0");
  const minute = String(value.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:00+09:00`;
}

function getNextScheduledRun(now = new Date()) {
  const kst = getKstParts(now);
  const candidates = [
    fromKstParts(kst.year, kst.month, kst.day, 7, 30),
    fromKstParts(kst.year, kst.month, kst.day, 18, 30),
  ];

  for (const candidate of candidates) {
    if (candidate > now) return candidate;
  }

  const tomorrow = new Date(fromKstParts(kst.year, kst.month, kst.day, 0, 0).getTime() + 24 * 60 * 60 * 1000);
  const next = getKstParts(tomorrow);
  return fromKstParts(next.year, next.month, next.day, 7, 30);
}

function scheduleNextRun() {
  if (scheduledTimer) clearTimeout(scheduledTimer);

  const next = getNextScheduledRun();
  generation.nextScheduledAt = toKstIso(next);
  const delay = Math.max(1000, next.getTime() - Date.now());

  scheduledTimer = setTimeout(() => {
    runGenerator("scheduled");
    scheduleNextRun();
  }, delay);
}

function runGenerator(reason) {
  if (generation.running) return false;

  generation.running = true;
  generation.reason = reason;
  generation.lastStartedAt = toKstIso(new Date());
  generation.lastFinishedAt = null;
  generation.lastError = null;
  generation.lastOutput = "";

  const child = spawn(process.execPath, [GENERATOR], {
    cwd: ROOT_DIR,
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    generation.lastOutput = `${generation.lastOutput}${chunk.toString()}`.slice(-4000);
  });

  child.stderr.on("data", (chunk) => {
    generation.lastOutput = `${generation.lastOutput}${chunk.toString()}`.slice(-4000);
  });

  child.on("close", (code) => {
    generation.running = false;
    generation.reason = null;
    generation.lastFinishedAt = toKstIso(new Date());
    generation.lastError = code === 0 ? null : `분석기가 종료 코드 ${code}로 멈췄습니다.`;
  });

  child.on("error", (error) => {
    generation.running = false;
    generation.reason = null;
    generation.lastFinishedAt = toKstIso(new Date());
    generation.lastError = error.message;
  });

  return true;
}

async function maybeRefreshOnStartup() {
  try {
    const latest = await stat(DATA_JSON);
    const ageMinutes = (Date.now() - latest.mtimeMs) / 60000;
    if (ageMinutes > STARTUP_STALE_MINUTES) runGenerator("startup-stale");
  } catch {
    runGenerator("startup-missing");
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/briefing") {
      sendJson(response, 200, await readBriefing());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/status") {
      sendJson(response, 200, generation);
      return;
    }

    if (request.method !== "GET") {
      sendText(response, 405, "Method not allowed");
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

function listen(port, attemptsLeft = 20) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }

    throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    scheduleNextRun();
    maybeRefreshOnStartup();
    console.log(`뉴스 키워드 브리핑 웹 앱: http://127.0.0.1:${port}`);
    console.log(`자동 분석 시각: 07:30, 18:30 KST`);
  });
}

listen(DEFAULT_PORT);
