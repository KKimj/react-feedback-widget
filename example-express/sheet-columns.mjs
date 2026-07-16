// 시트 컬럼 스키마 — 단일 SoT.
// mini-e2e-server.mjs(행 append)와 init-sheet.mjs(포맷 초기화)가 공유한다.
// 컬럼을 추가/변경할 때 여기만 고치면 append·헤더·너비·드롭다운이 함께 따라간다.

export const SHEET_COLUMNS = [
  { key: 'id',         header: 'ID',        field: 'id',            width: 175 },
  { key: 'priority',   header: '우선순위',  field: 'severity',      width: 80,  transform: (v) => v || '',
    validation: ['P0', 'P1', 'P2', 'P3'] },
  { key: 'feedback',   header: '원문',      field: 'feedback',      width: 340 },
  { key: 'status',     header: '상태',      field: 'status',        width: 90,  transform: (v) => v || '신규',
    validation: ['신규', '열림', '진행중', '검토중', '해결됨', '닫힘'] },
  { key: 'assignee',   header: '작업내용',  field: 'assignee',      width: 200, transform: (v) => v || '' },
  { key: 'component',  header: '요소',      field: 'component',     width: 150, transform: (v) => v || '' },
  { key: 'selector',   header: '셀렉터',    field: 'selector',      width: 210, transform: (v) => v || '' },
  { key: 'link',       header: '링크',      field: 'url',           width: 210 },
  { key: 'screenshot', header: '스크린샷',  field: 'screenshotUrl', width: 220,
    transform: (v) => (v ? `=IMAGE("${v}")` : '') },
  { key: 'imageUrl',   header: '이미지 URL', field: 'screenshotUrl', width: 300, transform: (v) => v || '' },
];

export const SHEET_COLUMN_ORDER = SHEET_COLUMNS.map((c) => c.key);
export const SHEET_HEADERS = SHEET_COLUMNS.map((c) => c.header);

// sheets.js 핸들러가 기대하는 { key: { header, field, transform } } 맵 형태로 변환
export function toColumnsMap() {
  const columns = {};
  for (const c of SHEET_COLUMNS) {
    columns[c.key] = { header: c.header, field: c.field, ...(c.transform ? { transform: c.transform } : {}) };
  }
  return columns;
}
