// Single source of truth for both the browser (React app) and this Express server.
//
// Add a destination by adding one line. Set its env var in your environment.
// That's the whole integration.

import { defineConfig, connect } from 'react-visual-feedback';

export default defineConfig({
  destinations: [
    connect.local(),                                     // browser fallback — always include
    connect.sheets(),                                    // env: GOOGLE_SERVICE_ACCOUNT, GOOGLE_SPREADSHEET_ID
    connect.slack({ channel: '#feedback' }),             // env: SLACK_WEBHOOK_URL (webhook 이 실제 채널을 결정)
  ],
  ui: { variant: 'two-column' },
});
