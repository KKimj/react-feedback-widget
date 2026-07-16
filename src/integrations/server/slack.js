/**
 * createSlackHandler — server-side handler for the slack() client adapter.
 *
 * Two modes:
 *   1. Incoming Webhook  (SLACK_WEBHOOK_URL)        — simpler; POSTs message blocks
 *   2. Bot token         (SLACK_BOT_TOKEN + channel) — richer; uses chat.postMessage
 *
 * The handler auto-picks based on which env is set; explicit config beats env.
 *
 * Severity drives the left-rail color of the Slack attachment:
 *   P0/critical → red    P1/high → orange    P2/medium → yellow    P3/low → grey
 */

import { warnIfInsecureFactory, buildEvidenceNote } from './_shared.js';

const warnIfInsecure = warnIfInsecureFactory('createSlackHandler');

const COLOR = {
  P0: '#dc2626', critical: '#dc2626',
  P1: '#ea580c', high:     '#ea580c',
  P2: '#facc15', medium:   '#facc15',
  P3: '#94a3b8', low:      '#94a3b8',
};

function buildMessage(feedbackData) {
  const title = (feedbackData.feedback || 'Feedback').slice(0, 150);
  const sev   = feedbackData.severity || feedbackData.priority || 'P2';
  const color = COLOR[sev] || '#94a3b8';
  const md    = (feedbackData.aiTicket?.markdown || feedbackData.feedback || '') + buildEvidenceNote(feedbackData);
  const url   = feedbackData.url || null;
  const user  = feedbackData.userName || 'someone';

  return {
    attachments: [{
      color,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🐛 ${title.slice(0, 150)}` },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*From* ${user}` },
            { type: 'mrkdwn', text: `*Severity* ${sev}` },
            url ? { type: 'mrkdwn', text: `*Page* ${url}` } : null,
            feedbackData.component ? { type: 'mrkdwn', text: `*요소* \`${feedbackData.component}\`` } : null,
            feedbackData.selector ? { type: 'mrkdwn', text: `*셀렉터* \`${String(feedbackData.selector).slice(0, 80)}\`` } : null,
            feedbackData.sheetUrl ? { type: 'mrkdwn', text: `*📄 <${feedbackData.sheetUrl}|스프레드시트에서 보기>*` } : null,
          ].filter(Boolean),
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: md.slice(0, 2500) || '_(no description)_' },
        },
        ...(feedbackData.screenshotUrl
          ? [{ type: 'image', image_url: feedbackData.screenshotUrl, alt_text: '스크린샷' }]
          : []),
      ],
    }],
  };
}

async function postViaWebhook({ url, message }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`slack webhook ${res.status}: ${text.slice(0, 300)}`);
  }
  return { id: null, url: null };
}

async function postViaBotToken({ token, channel, message }) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel, ...message }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`slack ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = await res.json();
  if (!body.ok) throw new Error(`slack: ${body.error || 'unknown'}`);
  return {
    id: body.ts || null,
    url: body.permalink || null,
  };
}

export function createSlackHandler(config = {}) {
  warnIfInsecure(config);

  return async (req, res) => {
    const webhookUrl = config.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    const botToken   = config.botToken   || process.env.SLACK_BOT_TOKEN;
    const channel    = config.channel    || process.env.SLACK_CHANNEL;
    if (!webhookUrl && !botToken) {
      throw new Error('createSlackHandler: missing SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN');
    }
    if (botToken && !channel) {
      throw new Error('createSlackHandler: SLACK_BOT_TOKEN requires SLACK_CHANNEL too');
    }

    const feedbackData = res?.authContext
      ? req
      : (typeof req?.json === 'function' ? await req.json() : req?.body || {});

    const message = buildMessage(feedbackData);
    const sent = webhookUrl
      ? await postViaWebhook({ url: webhookUrl, message })
      : await postViaBotToken({ token: botToken, channel, message });

    if (res && typeof res === 'object' && res.authContext) {
      return { data: sent };
    }
    if (res?.json) { res.status(200).json(sent); return; }
    return new Response(JSON.stringify(sent), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
}
