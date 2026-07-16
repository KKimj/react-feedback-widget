// 시트 포맷 초기화 — 헤더 기입 + 헤더 스타일·고정 + 컬럼 너비 + 행 높이 + 드롭다운(우선순위·상태).
// 컬럼 정의는 sheet-columns.mjs(SoT)에서 읽으므로 통합서버가 쓰는 스키마와 항상 일치한다.
//
// 실행 (SA 필요):
//   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json \
//   GOOGLE_SPREADSHEET_ID=<시트ID> SHEET_NAME='QA-위젯-데모' \
//   node init-sheet.mjs
//
// 탭이 없으면 새로 만들고, 있으면 헤더/서식만 다시 세팅한다(기존 데이터 행은 보존).
import { GoogleAuth } from 'google-auth-library';
import { SHEET_COLUMNS, SHEET_HEADERS } from './sheet-columns.mjs';

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const sheetName = process.env.SHEET_NAME || 'Feedback';

if (!keyFile || !spreadsheetId) {
  console.error('필요: GOOGLE_APPLICATION_CREDENTIALS(SA 키), GOOGLE_SPREADSHEET_ID');
  process.exit(1);
}

const auth = new GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const client = await auth.getClient();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
const colCount = SHEET_COLUMNS.length;

// A1 표기용 마지막 열 문자 (A~Z, 26칸까지)
const colLetter = (n) => String.fromCharCode(64 + n);

// 1. 탭 조회 (없으면 생성)
async function getSheet() {
  const meta = (await client.request({ url: `${base}?fields=sheets.properties` })).data;
  return (meta.sheets || []).find((s) => s.properties.title === sheetName);
}
let sheet = await getSheet();
if (!sheet) {
  await client.request({
    url: `${base}:batchUpdate`, method: 'POST',
    data: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
  });
  sheet = await getSheet();
  console.log(`+ 탭 '${sheetName}' 생성`);
}
const sheetId = sheet.properties.sheetId;

// 2. 헤더 기입 (RAW — 순수 텍스트)
await client.request({
  url: `${base}/values/${encodeURIComponent(`'${sheetName}'!A1:${colLetter(colCount)}1`)}?valueInputOption=RAW`,
  method: 'PUT', data: { values: [SHEET_HEADERS] },
});

// 3. 서식 batchUpdate
const requests = [];

// 3-1. 헤더 스타일 (진한 배경 + 흰 볼드 + 가운데)
requests.push({
  repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
    cell: {
      userEnteredFormat: {
        backgroundColor: { red: 0.12, green: 0.16, blue: 0.22 },
        textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
        horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
      },
    },
    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
  },
});

// 3-2. 헤더 행 고정
requests.push({
  updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
    fields: 'gridProperties.frozenRowCount',
  },
});

// 3-3. 컬럼 너비
SHEET_COLUMNS.forEach((c, i) => {
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: c.width }, fields: 'pixelSize',
    },
  });
});

// 3-4. 데이터 행 높이 (20px — 낮고 깔끔하게. =IMAGE 는 셀 크기에 맞춰 축소 표시)
requests.push({
  updateDimensionProperties: {
    range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1000 },
    properties: { pixelSize: 20 }, fields: 'pixelSize',
  },
});

// 3-5. 본문 셀 정렬 (세로 가운데 + 줄바꿈)
requests.push({
  repeatCell: {
    range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
    cell: { userEnteredFormat: { verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' } },
    fields: 'userEnteredFormat(verticalAlignment,wrapStrategy)',
  },
});

// 3-6. 드롭다운(데이터 검증) — 우선순위·상태
SHEET_COLUMNS.forEach((c, i) => {
  if (!c.validation) return;
  requests.push({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: i, endColumnIndex: i + 1 },
      rule: {
        condition: { type: 'ONE_OF_LIST', values: c.validation.map((v) => ({ userEnteredValue: v })) },
        showCustomUi: true, strict: false,
      },
    },
  });
});

await client.request({ url: `${base}:batchUpdate`, method: 'POST', data: { requests } });

// 4. (선택) 데이터 행 비우기 — 컬럼 구조(개수/순서)를 바꾼 뒤 옛 행이 한 칸씩 밀려 보일 때
//    CLEAR_DATA=1 로 헤더만 남기고 데이터(A2:)를 지워 정합을 맞춘다.
if (process.env.CLEAR_DATA === '1') {
  await client.request({
    url: `${base}/values/${encodeURIComponent(`'${sheetName}'!A2:Z100000`)}:clear`,
    method: 'POST', data: {},
  });
  console.log('  · 데이터 행(A2:) 비움 (CLEAR_DATA=1) — 옛 컬럼 구조로 쌓인 어긋난 행 정리');
}

console.log(`✓ 시트 '${sheetName}' 포맷 초기화 완료 — ${colCount}컬럼 · 헤더 고정 · 드롭다운(우선순위·상태) · 너비/행높이`);
