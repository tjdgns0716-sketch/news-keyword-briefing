# GitHub Pages 배포 순서

이 앱은 PC가 꺼져도 보이게 하려면 GitHub Pages에 올리고, GitHub Actions가 하루 2번 데이터를 새로 만들게 하는 방식이 가장 단순합니다.

## 1. GitHub 저장소 만들기

1. GitHub에 로그인합니다.
2. 새 저장소를 만듭니다.
3. 저장소 이름은 예를 들어 `news-keyword-briefing`으로 둡니다.
4. 공개 여부는 처음에는 `Private`로 두셔도 됩니다.

## 2. 이 폴더를 저장소에 올리기

올릴 기준 폴더는 아래 폴더입니다.

```text
C:\Users\whrbg\Documents\Codex\2026-06-13\new-chat\outputs\news-keyword-briefing
```

중요한 점은 `.env.local`은 올리면 안 됩니다. 이 파일은 `.gitignore`에 넣어 두었습니다.

## 3. GitHub Secrets에 네이버 키 넣기

GitHub 저장소 화면에서 아래로 들어갑니다.

```text
Settings > Secrets and variables > Actions > New repository secret
```

아래 2개를 각각 만듭니다.

```text
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

값은 사용자님 PC의 `.env.local`에 저장해 둔 네이버 API 키를 그대로 넣으면 됩니다.

## 4. GitHub Pages 켜기

GitHub 저장소에서 아래로 들어갑니다.

```text
Settings > Pages
```

Build and deployment의 Source를 `GitHub Actions`로 선택합니다.

## 5. 첫 실행하기

GitHub 저장소에서 아래로 들어갑니다.

```text
Actions > Update and deploy briefing > Run workflow
```

처음 실행이 성공하면 Pages 주소가 생깁니다. 이후에는 한국시간 07:30, 18:30에 자동으로 다시 분석하고 배포합니다.

## 현재 자동 실행 시간

- 07:30 KST
- 18:30 KST

GitHub Actions의 cron은 UTC 기준이라 설정 파일에는 각각 `22:30`, `09:30`으로 들어가 있습니다.
