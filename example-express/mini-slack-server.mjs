// 위젯의 slack destination 핸들러만 떼어 실증 (index.js styled 크래시 우회)
import express from 'express';
import { createSlackHandler } from '../src/integrations/server/slack.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

const slack = createSlackHandler({}); // env: SLACK_WEBHOOK_URL

app.post('/api/feedback/slack', async (req, res) => {
  try {
    await slack(req, res);
  } catch (e) {
    console.error('slack error:', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.listen(3003, () => console.log('mini slack server on http://localhost:3003'));
