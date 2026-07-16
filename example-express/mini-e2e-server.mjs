// 위젯 원클릭 e2e 통합 서버 — 설정은 전부 .env 로 주입 (.env.example 참고)
// screenshot(base64) → Storage 업로드 + 시트 append + Slack 카드 를 한 번에 처리
import express from 'express';
import { Storage } from '@google-cloud/storage';
import createSheetsHandler from '../src/integrations/sheets.js';
import { createSlackHandler } from '../src/integrations/server/slack.js';

// ── 설정 (env 로 주입, 없으면 placeholder) ──
const CONFIG = {
  keyFile:       process.env.GOOGLE_APPLICATION_CREDENTIALS || 'your-key',
  bucket:        process.env.STORAGE_BUCKET || 'your-bucket',
  storagePath:   process.env.STORAGE_PATH || 'public/qa',
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
  sheetName:     process.env.SHEET_NAME || 'Feedback',
  port:          Number(process.env.PORT) || 3010,
  // SLACK_WEBHOOK_URL (또는 SLACK_BOT_TOKEN + SLACK_CHANNEL) 은 slack 핸들러가 env 에서 직접 읽음
};

const storage = new Storage({ keyFilename: CONFIG.keyFile });
const bucket = storage.bucket(CONFIG.bucket);

const sheets = createSheetsHandler({
  sheetName: CONFIG.sheetName,
  __allowUnwrappedInProd: true,
  // 시트 컬럼 매핑: ID | 우선순위 | 원문 | 상태 | 작업내용 | 요소 | 셀렉터 | 링크 | 스크린샷
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
      fb.id = `qa-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }
    // 스크린샷 base64 → Storage 업로드 → 공개 URL
    const shot = fb.screenshot;
    if (typeof shot === 'string' && shot.startsWith('data:')) {
      const m = shot.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) {
        const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
        const name = `${CONFIG.storagePath}/${fb.id}.${ext}`;
        await bucket.file(name).save(Buffer.from(m[2], 'base64'), { contentType: m[1] });
        fb.screenshotUrl = `https://firebasestorage.googleapis.com/v0/b/${CONFIG.bucket}/o/${encodeURIComponent(name)}?alt=media`;
      }
    }
    if (CONFIG.spreadsheetId) fb.sheetUrl = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/edit`;
    // 시트 append + Slack 카드
    await sheets({ body: { action: 'append', feedbackData: fb } }, null);
    await slack({ body: fb }, null);
    res.json({ ok: true, id: fb.id, screenshotUrl: fb.screenshotUrl || null });
  } catch (e) {
    console.error('e2e error:', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.listen(CONFIG.port, () => console.log(`mini e2e server on http://localhost:${CONFIG.port}`));
