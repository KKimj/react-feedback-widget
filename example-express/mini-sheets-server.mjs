// 위젯의 sheets destination 핸들러만 떼어 실증 (index.js의 styled-components 크래시 우회)
import express from 'express';
import createSheetsHandler from '../src/integrations/sheets.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

const sheets = createSheetsHandler({
  sheetName: 'QA-위젯-데모',
  __allowUnwrappedInProd: true,
  // 우리 시트 컨벤션에 맞춘 컬럼 매핑: ID | 우선순위 | 원문 | 상태 | 작업내용 | 링크
  columnOrder: ['id', 'priority', 'feedback', 'status', 'assignee', 'link', 'screenshot'],
  columns: {
    id:         { header: 'ID',       field: 'id' },
    priority:   { header: '우선순위', field: 'severity', transform: (v) => v || '' },
    feedback:   { header: '원문',     field: 'feedback' },
    status:     { header: '상태',     field: 'status', transform: (v) => v || '' },
    assignee:   { header: '작업내용', field: 'assignee', transform: (v) => v || '' },
    link:       { header: '링크',     field: 'url' },
    screenshot: { header: '스크린샷', field: 'screenshotUrl', transform: (v) => (v ? `=IMAGE("${v}")` : '') },
  },
});

app.post('/api/feedback/sheets', async (req, res) => {
  try {
    await sheets(req, res);
  } catch (e) {
    console.error('sheets error:', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.listen(3002, () => console.log('mini sheets server on http://localhost:3002'));
