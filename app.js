let briefing = window.BRIEFING_DATA ?? null;
let staticMode = false;

const typeLabel = {
  words: "용어",
  people: "인물",
};

const state = {
  activeKey: null,
};

const grid = document.querySelector("#categoryGrid");
const updatedAt = document.querySelector("#updatedAt");
const rangeText = document.querySelector("#rangeText");
const nextUpdate = document.querySelector("#nextUpdate");
const analysisStatus = document.querySelector("#analysisStatus");

const detailMeta = document.querySelector("#detailMeta");
const detailTitle = document.querySelector("#detailTitle");
const detailCount = document.querySelector("#detailCount");
const detailDelta = document.querySelector("#detailDelta");
const definitionHeading = document.querySelector("#definitionHeading");
const detailDefinition = document.querySelector("#detailDefinition");
const detailContext = document.querySelector("#detailContext");
const detailRelated = document.querySelector("#detailRelated");
const detailArticles = document.querySelector("#detailArticles");

function appUrl(path) {
  return new URL(path, window.location.href).toString();
}

function formatKoreanDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getFirstKey(data) {
  const firstCategory = data?.categories?.[0];
  if (!firstCategory) return null;
  if (firstCategory.words?.length) return `${firstCategory.id}-words-0`;
  if (firstCategory.people?.length) return `${firstCategory.id}-people-0`;
  return null;
}

function findItemByKey(key) {
  if (!key || !briefing) return null;

  const [categoryId, type, indexText] = key.split("-");
  const category = briefing.categories.find((entry) => entry.id === categoryId);
  const index = Number(indexText);
  const item = category?.[type]?.[index];

  if (!category || !item) return null;
  return { category, type, index, item };
}

function renderSchedule() {
  updatedAt.textContent = formatKoreanDateTime(briefing?.generatedAt);
  rangeText.textContent = briefing?.rangeText ?? "-";
  nextUpdate.textContent = formatKoreanDateTime(briefing?.nextUpdateAt);
}

function setAnalysisStatus(text) {
  if (analysisStatus) analysisStatus.textContent = text;
}

async function refreshStatus() {
  if (window.location.protocol === "file:") {
    setAnalysisStatus("파일 보기");
    return;
  }

  try {
    const response = await fetch(appUrl("./api/status"), { cache: "no-store" });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const status = await response.json();
    staticMode = false;

    if (status.running) {
      setAnalysisStatus("분석 중");
      return;
    }

    if (status.lastError) {
      setAnalysisStatus("확인 필요");
      return;
    }

    setAnalysisStatus("자동 대기");
  } catch {
    staticMode = true;
    setAnalysisStatus(briefing ? "정적 배포" : "데이터 확인");
  }
}

async function loadBriefing(options = {}) {
  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(appUrl("./api/briefing"), { cache: "no-store" });
      if (!response.ok) throw new Error(`briefing ${response.status}`);
      briefing = await response.json();
      staticMode = false;
    } catch {
      try {
        const response = await fetch(appUrl("./data/latest.json"), { cache: "no-store" });
        if (!response.ok) throw new Error(`latest ${response.status}`);
        briefing = await response.json();
        staticMode = true;
        if (!options.silent) setAnalysisStatus("정적 배포");
      } catch {
        if (!briefing && window.BRIEFING_DATA) {
          briefing = window.BRIEFING_DATA;
          staticMode = true;
        }
        if (!options.silent) setAnalysisStatus(briefing ? "정적 배포" : "데이터 확인");
      }
    }
  }

  renderApp();
}

function createRankList(category, type) {
  const list = document.createElement("ol");
  list.className = "rank-list";
  const entries = category[type] ?? [];

  if (!entries.length) {
    const row = document.createElement("li");
    row.className = "rank-empty";
    row.textContent = type === "people" ? "선정된 인물 없음" : "선정된 용어 없음";
    list.append(row);
    return list;
  }

  entries.forEach((item, index) => {
    const key = `${category.id}-${type}-${index}`;
    const row = document.createElement("li");
    row.className = "rank-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `rank-button ${type === "people" ? "person" : ""}`;
    button.dataset.key = key;
    button.setAttribute("aria-pressed", String(state.activeKey === key));
    button.innerHTML = `
      <span class="rank-no">${index + 1}</span>
      <span class="rank-term">${item.term}</span>
      <span class="rank-count">${Number(item.count).toLocaleString("ko-KR")}</span>
    `;

    if (state.activeKey === key) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      state.activeKey = key;
      renderGrid();
      renderDetail();

      if (window.matchMedia("(max-width: 1040px)").matches) {
        document.querySelector(".detail-panel").scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      }
    });

    row.append(button);
    list.append(row);
  });

  return list;
}

function renderGrid() {
  grid.replaceChildren();

  briefing.categories.forEach((category) => {
    const panel = document.createElement("article");
    panel.className = "category-panel";
    panel.style.setProperty("--accent", category.accent);

    const head = document.createElement("header");
    head.className = "category-head";
    head.innerHTML = `
      <h2 class="category-title">${category.label}</h2>
      <span class="sample-badge">${briefing.statusLabel ?? "분석 데이터"}</span>
    `;
    panel.append(head);

    const wordSection = document.createElement("section");
    wordSection.className = "rank-section";
    wordSection.innerHTML = `<p class="rank-label">용어 TOP 5</p>`;
    wordSection.append(createRankList(category, "words"));
    panel.append(wordSection);

    const peopleSection = document.createElement("section");
    peopleSection.className = "rank-section";
    peopleSection.innerHTML = `<p class="rank-label">인물 TOP 3</p>`;
    peopleSection.append(createRankList(category, "people"));
    panel.append(peopleSection);

    grid.append(panel);
  });
}

function renderDetail() {
  const selected = findItemByKey(state.activeKey);
  if (!selected) return;

  const { category, type, index, item } = selected;
  detailMeta.textContent = `${category.label} · ${typeLabel[type]} ${index + 1}위`;
  detailTitle.textContent = item.term;
  detailCount.textContent = Number(item.count).toLocaleString("ko-KR");
  detailDelta.textContent = item.delta ?? "-";
  definitionHeading.textContent = type === "people" ? "인물" : "설명";
  renderParagraphs(detailDefinition, item.definition ?? "");
  renderParagraphs(detailContext, item.context ?? "");

  detailRelated.replaceChildren(
    ...(item.related ?? []).map((word) => {
      const chip = document.createElement("li");
      chip.textContent = word;
      return chip;
    }),
  );

  detailArticles.replaceChildren(
    ...(item.articles ?? []).map((title) => {
      const row = document.createElement("li");
      row.textContent = title;
      return row;
    }),
  );
}

function renderParagraphs(container, text) {
  const normalized = String(text).replace(
    /\n(?=(왜 중요한가|헷갈리기 쉬운 점|왜 이슈인가|왜 .+에 선정됐나):)/g,
    "\n\n",
  );
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  container.replaceChildren(
    ...blocks.map((block) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = block;
      return paragraph;
    }),
  );
}

function renderEmptyState() {
  grid.innerHTML = `
    <article class="category-panel">
      <header class="category-head">
        <h2 class="category-title">데이터 없음</h2>
        <span class="sample-badge">대기 중</span>
      </header>
      <section class="rank-section">
        <p class="rank-label">아직 분석 결과가 없습니다.</p>
      </section>
    </article>
  `;
}

function renderApp() {
  if (!briefing?.categories?.length) {
    renderEmptyState();
    renderSchedule();
    return;
  }

  if (!findItemByKey(state.activeKey)) {
    state.activeKey = getFirstKey(briefing);
  }

  renderSchedule();
  renderGrid();
  renderDetail();
}

async function refreshApp() {
  await refreshStatus();
  await loadBriefing({ silent: true });
  if (staticMode) setAnalysisStatus("정적 배포");
}

loadBriefing();
refreshStatus();
setInterval(refreshApp, 5 * 60 * 1000);
