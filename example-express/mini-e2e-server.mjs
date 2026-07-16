// 위젯 원클릭 e2e 통합 서버: screenshot(base64)→Storage 업로드 + 시트 append + Slack 카드
import express from 'express';
import { Storage } from '@google-cloud/storage';
import createSheetsHandler from '../src/integrations/sheets.js';
import { createSlackHandler } from '../src/integrations/server/slack.js';

const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'your-key';
const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const BUCKET = process.env.STORAGE_BUCKET || 'your-bucket';

const storage = new Storage({ keyFilename: KEY });
const bucket = storage.bucket(BUCKET);

const sheets = createSheetsHandler({
  sheetName: 'QA-위젯-데모',
  __allowUnwrappedInProd: true,
  columnOrder: ['id', 'priority', 'feedback', 'status', 'assignee', 'component', 'selector', 'link', 'screenshot'],
  columns: {
    id:         { header: 'ID',       field: 'id' },
    priority:   { header: '우선순위', field: 'severity', transform: (v) => v || '' },
    feedback:   { header: '원문',     field: 'feedback' },
    status:     { header: '상태',     field: 'status', transform: (v) => v || '' },
    assignee:   { header: '작업내용', field: 'assignee', transform: (v) => v || '' },
    component:  { header: '요소',     field: 'component', transform: (v) => v || '' },
    selector:   { header: '셀렉터',   field: 'selector', transform: (v) => v || '' },
    link:       { header: '링크',     field: 'url' },
    screenshot: { header: '스크린샷', field: 'screenshotUrl', transform: (v) => (v ? `=IMAGE("${v}")` : '') },
  },
});
const slack = createSlackHandler({}); // env: SLACK_WEBHOOK_URL

const app = express();
app.use(express.json({ limit: '25mb' }));

app.post('/api/feedback', async (req, res) => {
  try {
    const fb = { ...req.body };
    // 위젯 필드 → slack/sheets 기대 필드로 정규화
    fb.feedback = fb.feedback || fb.description || '(내용 없음)';
    fb.severity = fb.severity || fb.priority || 'P2';
    fb.selector = fb.elementInfo?.selector || fb.selector || '';
    fb.component = fb.component || fb.elementInfo?.reactComponent || fb.elementInfo?.tagName || '';
    if (!fb.id) {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      fb.id = `qa-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    }
    // 스크린샷 base64 → Firebase Storage(public/qa) → 공개 URL
    const shot = fb.screenshot;
    if (typeof shot === 'string' && shot.startsWith('data:')) {
      const m = shot.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) {
        const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
        const name = `public/qa/${fb.id}.${ext}`;
        await bucket.file(name).save(Buffer.from(m[2], 'base64'), { contentType: m[1] });
        fb.screenshotUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(name)}?alt=media`;
      }
    }
    if (SHEET_ID) fb.sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
    // 시트 append + Slack 카드
    await sheets({ body: { action: 'append', feedbackData: fb } }, null);
    await slack({ body: fb }, null);
    res.json({ ok: true, id: fb.id, screenshotUrl: fb.screenshotUrl || null });
  } catch (e) {
    console.error('e2e error:', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.listen(3010, () => console.log('mini e2e server on http://localhost:3010'));
