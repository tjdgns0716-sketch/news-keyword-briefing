# 뉴스 키워드 브리핑

정치, 경제, 사회, 문화 분야별로 최근 뉴스에서 반복 등장한 학습용 용어 TOP 5와 인물 TOP 3을 보여주는 웹 앱입니다.

## 현재 수집 방식

- 기본값은 `COLLECTION_MODE=section`입니다.
- 네이버 뉴스 검색어를 넣는 방식이 아니라, 네이버 뉴스의 날짜별 섹션 목록에서 최근 기사 링크를 먼저 가져옵니다.
- 섹션 매핑은 정치 `100`, 경제 `101`, 사회 `102`, 문화/생활 `103`입니다.
- 현재 섹션 첫 화면과 관련뉴스 묶음도 보강 수집합니다.
- 각 기사 URL에 접속한 뒤 기사 본문 영역만 추출해 분석합니다.
- 기사 본문은 저장하지 않습니다. `data/article-cache.json`에는 제목, 링크, 발행시각, 추출된 용어/인물만 저장해 흐름을 누적합니다.
- 검색 API 방식은 `COLLECTION_MODE=search`로 명시했을 때의 예비 방식으로만 남겨두었습니다.

## 로컬 웹 앱으로 실행

PowerShell에서 이 폴더로 이동한 뒤 실행합니다.

```powershell
.\start-web-app.ps1
```

실행되면 브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:4173
```

이미 4173 포트가 사용 중이면 서버가 다음 빈 포트를 자동으로 찾습니다.

## 웹 앱에서 하는 일

- `index.html`, `app.js`, `styles.css`를 웹 서버로 제공합니다.
- `/api/briefing`에서 최신 분석 결과를 JSON으로 제공합니다.
- `/api/status`에서 분석기가 실행 중인지 알려줍니다.
- `.env.local`, 수집 스크립트, 기사 캐시 원본은 웹으로 제공하지 않습니다.
- 서버가 켜져 있는 동안 07:30, 18:30 KST에 분석기를 자동 실행합니다.

## PC가 꺼져도 돌아가게 배포하기

로컬 서버는 사용자님 PC가 켜져 있을 때만 돌아갑니다. PC가 꺼져도 계속 보이게 하려면 GitHub Pages와 GitHub Actions로 배포합니다.

- 웹 화면은 GitHub Pages가 제공합니다.
- 분석 작업은 GitHub Actions가 하루 2번 실행합니다.
- 네이버 API 키는 `.env.local`을 올리지 않고 GitHub Secrets에 넣습니다.
- 배포되는 파일은 `index.html`, `app.js`, `styles.css`, `data/latest.json`, `data/latest.js`뿐입니다.

자세한 순서는 [docs/deploy-github-pages.md](./docs/deploy-github-pages.md)에 적어두었습니다.

## 분석 데이터 생성

```powershell
& 'C:\Users\whrbg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\scripts\generate-briefing.mjs
```

## 자동 업데이트 권장 시간

하루 2회 실행 기준입니다.

- 07:30 KST
- 18:30 KST

GitHub Actions 예약 실행은 몇 분 늦거나 특정 실행이 빠질 수 있어 백업 실행을 함께 둡니다.

- 07:30, 07:45, 08:00 KST
- 18:30, 18:45, 19:00 KST

이미 최근 6시간 안에 갱신된 데이터가 있으면 백업 실행은 분석을 건너뜁니다.
