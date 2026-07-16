# example-express — 위젯 원클릭 QA 통합 서버

위젯 제보를 한 번에 처리하는 최소 서버(`mini-e2e-server.mjs`):
스크린샷(base64) → Cloud Storage 업로드 + Google Sheets 기입 + Slack 카드.

## 설정

`.env.example` 을 `.env` 로 복사해 값을 채웁니다. **그 파일에 있는 키가 서버가 읽는 전부**입니다.
서비스 계정(SA)은 선택 — 없으면 Storage/Sheets 는 건너뛰고 Slack 만 동작합니다.

## 실행

```bash
cd example-express
npm install
npm run init-sheet   # (SA 있을 때) 시트 헤더·서식·드롭다운 초기화 — 최초 1회
npm start            # mini-e2e-server.mjs → http://localhost:3010
```

위젯 데모(별도 터미널):

```bash
cd ../example && npm install && npm run dev   # vite proxy 로 /api/feedback → 3010
```

## 파일

| 파일 | 역할 |
|---|---|
| `mini-e2e-server.mjs` | 통합 서버 — Storage 업로드 + Sheets append + Slack 카드 |
| `sheet-columns.mjs` | 시트 컬럼 스키마 **단일 SoT** (서버 append 와 init 이 공유) |
| `init-sheet.mjs` | 시트 포맷 초기화 (헤더 고정·컬럼너비·드롭다운). `CLEAR_DATA=1` 로 데이터까지 비우기 |
| `.env.example` | 설정 문서 (실제 읽는 env 전부) |
