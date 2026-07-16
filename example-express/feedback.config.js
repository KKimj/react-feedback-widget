// destination/ui 설정을 .env 로 주입 (.env.example 참고)
// ⚠️ 이 파일은 서버(express)에서 로드됩니다. 브라우저와 공유하려면
//    process.env → import.meta.env(VITE_*) 로 분기하세요.
import { defineConfig, connect } from 'react-visual-feedback';

const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

// destination 목록을 env 플래그로 구성 (기본 활성, "false" 로 끄기)
const destinations = [connect.local()]; // browser fallback — always include
if (env.ENABLE_SHEETS !== 'false') {
  destinations.push(connect.sheets());  // env: GOOGLE_SERVICE_ACCOUNT, GOOGLE_SPREADSHEET_ID
}
if (env.ENABLE_SLACK !== 'false') {
  destinations.push(connect.slack({ channel: env.SLACK_CHANNEL || '#feedback' })); // env: SLACK_WEBHOOK_URL
}

export default defineConfig({
  destinations,
  ui: { variant: env.FEEDBACK_UI_VARIANT || 'two-column' },
});
