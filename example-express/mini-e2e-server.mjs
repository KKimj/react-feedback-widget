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
import { GoogleAuth } from 'google-auth-library';
import { SHEET_COLUMN_ORDER, toColumnsMap } from './sheet-columns.mjs';

// ── 설정 (env 주입) ──
const CONFIG = {
  keyFile:       process.env.GOOGLE_APPLICATION_CREDENTIALS || '',   // 선택: 없으면 Storage/Sheets 비활성
  bucket:        process.env.STORAGE_BUCKET || '',
  storagePath:   process.env.STORAGE_PATH || 'public/qa',
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
  sheetName:     process.env.SHEET_NAME || 'Feedback',
  // 시트 링크: 명시 SHEET_URL 우선. 없으면 아래서 실제 기입 탭(gid)까지 포함해 자동 생성.
  sheetUrlOverride: process.env.SHEET_URL || '',
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
      columnOrder: SHEET_COLUMN_ORDER,   // 컬럼 정의는 sheet-columns.mjs(SoT) 공유 — init-sheet.mjs 와 일치
      columns: toColumnsMap(),
    })
  : null;
const slack = createSlackHandler({}); // env: SLACK_WEBHOOK_URL

// 스프레드시트 링크 — Slack 카드가 "실제 기입되는 탭(gid)"을 정확히 가리키게 한다.
// SHEET_URL 을 명시하면 그대로. 아니면 SA 로 sheetName→gid 를 조회해 gid 포함 링크를 만든다.
async function resolveSheetGid() {
  if (!saEnabled || !CONFIG.spreadsheetId) return null;
  try {
    const auth = new GoogleAuth({ keyFile: CONFIG.keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const client = await auth.getClient();
    const meta = (await client.request({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}?fields=sheets.properties`,
    })).data;
    const sheet = (meta.sheets || []).find((s) => s.properties.title === CONFIG.sheetName);
    return sheet?.properties?.sheetId ?? null;
  } catch {
    return null;
  }
}
const sheetGid = await resolveSheetGid();
const SHEET_LINK = CONFIG.sheetUrlOverride
  || (CONFIG.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/edit${sheetGid != null ? `?gid=${sheetGid}#gid=${sheetGid}` : ''}`
        : '');

console.log(`[config] SA=${saEnabled ? 'on' : 'off'} · Storage=${bucket ? 'on' : 'off'} · Sheets=${sheets ? 'on' : 'off'} · Slack=on · sheetLink=${SHEET_LINK || '(none)'}`);

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
    fb.reporter = fb.reporter || fb.userName || fb.userEmail || '';   // 제보자: 위젯 userName/userEmail prop 에서
    if (!fb.id) {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      fb.id = `qa-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }
    // 스크린샷 base64 → Storage 업로드 (SA 있을 때만). 셀렉터 + 전체화면 2장.
    async function uploadShot(dataUrl, suffix) {
      if (!bucket || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
      const m = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!m) return null;
      const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
      const name = `${CONFIG.storagePath}/${fb.id}${suffix}.${ext}`;
      await bucket.file(name).save(Buffer.from(m[2], 'base64'), { contentType: m[1] });
      return `https://firebasestorage.googleapis.com/v0/b/${CONFIG.bucket}/o/${encodeURIComponent(name)}?alt=media`;
    }
    fb.screenshotUrl = (await uploadShot(fb.screenshot, '')) || fb.screenshotUrl;
    fb.fullScreenshotUrl = (await uploadShot(fb.fullScreenshot, '-full')) || fb.fullScreenshotUrl;
    if (SHEET_LINK) fb.sheetUrl = SHEET_LINK;
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
