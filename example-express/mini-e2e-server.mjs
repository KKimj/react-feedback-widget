// 위젯 원클릭 e2e 통합 서버 — 설정은 전부 .env 로 주입 (.env.example 참고)
// screenshot(base64) → Storage 업로드 + 시트 append + Slack 카드
//
// 서비스 계정(SA)은 선택사항:
//   - SA 있음 → Storage 업로드 + Sheets 기입 + Slack
//   - SA 없음 → Slack 만 (시트가 public/Apps Script 이거나 Slack 만 쓰는 경우)
import express from 'express';
import { Storage } from '@google-cloud/storage';
import createSheetsHandler from '../src/integrations/sheets.js';
import { createSlackHandler } from '../src/integrations/server/slack.js';
import { readFileSync, existsSync } from 'node:fs';

// ── 설정 (env 주입) ──
const CONFIG = {
  keyFile:       process.env.GOOGLE_APPLICATION_CREDENTIALS || '',   // 선택: 없으면 Storage/Sheets 비활성
  bucket:        process.env.STORAGE_BUCKET || '',
  storagePath:   process.env.STORAGE_PATH || 'public/qa',
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
  sheetName:     process.env.SHEET_NAME || 'Feedback',
  // 시트 링크: 명시 SHEET_URL 우선, 없으면 spreadsheetId 로 생성 (둘 다 없으면 링크 생략)
  sheetUrl:      process.env.SHEET_URL
                   || (process.env.GOOGLE_SPREADSHEET_ID
                        ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}/edit`
                        : ''),
  port:          Number(process.env.PORT) || 3010,
};

// SA 는 선택 — 키 파일이 실제로 있을 때만 Storage/Sheets 활성화
const saEnabled = !!CONFIG.keyFile && existsSync(CONFIG.keyFile);
const saCredentials = saEnabled ? JSON.parse(readFileSync(CONFIG.keyFile, 'utf8')) : undefined;

const storage = (saEnabled && CONFIG.bucket) ? new Storage({ keyFilename: CONFIG.keyFile }) : null;
const bucket = storage ? storage.bucket(CONFIG.bucket) : null;

const sheets = saEnabled
  ? createSheetsHandler({
      sheetName: CONFIG.sheetName,
      credentials: saCredentials,
      spreadsheetId: CONFIG.spreadsheetId,
      __allowUnwrappedInProd: true,
      columnOrder: ['id', 'priority', 'feedback', 'status', 'assignee', 'component', 'selector', 'link', 'screenshot', 'imageUrl'],
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
        imageUrl:   { header: '이미지 URL', field: 'screenshotUrl', transform: (v) => v || '' },
      },
    })
  : null;
const slack = createSlackHandler({}); // env: SLACK_WEBHOOK_URL

console.log(`[config] SA=${saEnabled ? 'on' : 'off'} · Storage=${bucket ? 'on' : 'off'} · Sheets=${sheets ? 'on' : 'off'} · Slack=on`);

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
    // 스크린샷 base64 → Storage 업로드 (SA 있을 때만)
    const shot = fb.screenshot;
    if (bucket && typeof shot === 'string' && shot.startsWith('data:')) {
      const m = shot.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) {
        const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
        const name = `${CONFIG.storagePath}/${fb.id}.${ext}`;
        await bucket.file(name).save(Buffer.from(m[2], 'base64'), { contentType: m[1] });
        fb.screenshotUrl = `https://firebasestorage.googleapis.com/v0/b/${CONFIG.bucket}/o/${encodeURIComponent(name)}?alt=media`;
      }
    }
    if (CONFIG.sheetUrl) fb.sheetUrl = CONFIG.sheetUrl;
    // 시트 append (SA 있을 때만) + Slack 카드(항상)
    if (sheets) await sheets({ body: { action: 'append', feedbackData: fb } }, null);
    await slack({ body: fb }, null);
    res.json({ ok: true, id: fb.id, screenshotUrl: fb.screenshotUrl || null, sheetsWritten: !!sheets });
  } catch (e) {
    console.error('e2e error:', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.listen(CONFIG.port, () => console.log(`mini e2e server on http://localhost:${CONFIG.port}`));
