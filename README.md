<!-- ───────────────────────────────────────────── -->
<!--  Team-SpaceY QA fork                          -->
<!-- ───────────────────────────────────────────── -->

> ## 🛠 Team-SpaceY QA fork
>
> 이 저장소는 [`Murali1889/react-feedback-widget`](https://github.com/Murali1889/react-feedback-widget) 를 **Team-SpaceY 내부 QA 용으로 커스터마이징한 fork** 입니다. 원본 문서는 아래(`# react-visual-feedback`)로 이어집니다.
>
> ### 추가·수정된 것
> - 🖊 **스크린샷 펜 드로잉** — 모달 안 스크린샷 위에 빨간펜 표시(`react-sketch-canvas`), 제출 시 이미지에 자동 합성. 툴바(펜/지우개/되돌리기/전체지우기)
> - 🇰🇷 **한글 UI** — 모달·카테고리·우선순위
> - 🏷 **제출 ID** — `qa-YYYY-MM-DD-HHMMSS` 형식(초까지)
> - 🐛 **버그 수정** — Google Sheets `append` 가 쿼리스트링을 JSON body 에 붙여 400 나던 문제(→ URL 로 이동 + `USER_ENTERED`)
> - 💬 **Slack 카드 강화** — 이미지 블록 + 선택 요소(`component`/`selector`) + 스프레드시트 링크(옵션)
> - 📄 **시트 컬럼** — `ID·우선순위·원문·제보자·상태·담당자·작업내용·요소·셀렉터·링크·스크린샷(=IMAGE)·이미지 URL` (제보자 = 위젯 `userName`/`userEmail` prop)
> - 🎨 **시트 포맷 초기화**([`example-express/init-sheet.mjs`](./example-express/init-sheet.mjs)) — 헤더/헤더고정/컬럼너비/행높이 + 우선순위·상태 **드롭다운**을 한 번에 세팅. 컬럼 정의는 [`sheet-columns.mjs`](./example-express/sheet-columns.mjs) **단일 SoT**(통합 서버 append 와 공유 → 컬럼 바꿔도 서로 안 어긋남)
> - 🔗 **원클릭 e2e 통합 서버**([`example-express/mini-e2e-server.mjs`](./example-express/mini-e2e-server.mjs)) — 스크린샷 base64 → Cloud Storage 업로드 + Google Sheets + Slack 을 한 번에. SA(서비스계정)는 **선택** — 없으면 Slack 만 동작
>
> ### 빠른 시작 (통합 서버)
> ```bash
> cd example-express
> npm install
> cp .env.example .env          # 서비스계정·버킷·시트·Slack 값 채우기
> node init-sheet.mjs           # (SA 있을 때) 시트 헤더·서식·드롭다운 초기화 — 최초 1회
> node mini-e2e-server.mjs       # http://localhost:3010
> ```
> 위젯 데모(별도 터미널): `cd example && npm install && npm run dev` — vite proxy 로 `/api/feedback` 을 통합 서버로 넘깁니다.
>
> 설정값은 전부 [`example-express/.env.example`](./example-express/.env.example) 참고 (하드코딩 없음).
>
> ---

# react-visual-feedback

**[Live demo](https://react-library-demo-rosy.vercel.app/)** · [Quickstart](./docs/QUICKSTART.md) · [Integration Guide](./docs/INTEGRATION.md) · [AI Agent Guide](./AGENTS.md)

Drop-in React widget. Press `Alt+A`, click on a broken element, type what's wrong, hit send — a fully-contexted bug report (screenshot, screen-recording, voice memo, console/network/storage traces, React component state, source-mapped `file:line`) lands in GitHub Issues / Linear / Slack / Discord / Notion / HubSpot / Sheets / Supabase / Jira / your webhook. The browser never holds a private credential.

---

## ⚡ Integrate in 3 minutes — one command

```bash
npx rvf init --auth github
```

That single command:
1. Detects your framework — Next.js (App / Pages Router), Vite, Express
2. Writes `feedback.config.ts`
3. Writes the catch-all API route (`app/api/feedback/[...rest]/route.ts` on Next App Router)
4. Opens GitHub's fine-grained PAT page **with the right scope pre-selected**, you click "Generate"
5. Writes `GITHUB_TOKEN` + `GITHUB_REPO` to `.env.local`

Then add **one line** to your root layout — paste the snippet the CLI prints:

```tsx
// app/layout.tsx
import feedbackConfig from './feedback.config'
import { FeedbackProvider } from 'react-visual-feedback'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <FeedbackProvider {...feedbackConfig}>{children}</FeedbackProvider>
      </body>
    </html>
  )
}
```

Restart your dev server. Press **`Alt+A`** to file your first feedback. Done.

> Swap `github` for any other destination — they all use the same `npx rvf init --auth <name>` shape. The full destination matrix is below.

---

## All destinations — copy a row, you're done

| Destination | One-line CLI | Env vars the CLI writes | Setup time | Auto-handles |
|---|---|---|---|---|
| **local** (browser) | `npx rvf init --destinations=local` | *(none — uses localStorage)* | 30s | nothing — works offline |
| **github** Issues | `npx rvf init --auth github` | `GITHUB_TOKEN`, `GITHUB_REPO` | ~3 min | opens prefilled fine-grained PAT page, scoped to `Issues: write` on the picked repo |
| **linear** | `npx rvf init --auth linear` | `LINEAR_API_KEY`, `LINEAR_TEAM_ID` | ~2.5 min | deep-links `/settings/api`, paste key, picks the team automatically |
| **slack** channel | `npx rvf init --auth slack` | `SLACK_WEBHOOK_URL` | ~3 min | opens app-create page with a prefilled manifest (incoming-webhook scope) |
| **discord** channel | `npx rvf init --auth discord` | `DISCORD_WEBHOOK_URL` | ~3 min | paste webhook URL — full multipart binary upload (screenshot + video + audio attached inline) |
| **notion** database | `npx rvf init --auth notion` | `NOTION_TOKEN`, `NOTION_DB_ID` | ~4 min | active-polls `/v1/search` until you share a DB with the integration |
| **hubspot** tickets | `npx rvf init --auth hubspot` | `HUBSPOT_TOKEN`, `HUBSPOT_PIPELINE`, `HUBSPOT_STAGE` | ~4 min | auto-fetches your pipelines + stages, picks if there's only one |
| **sheets** (Google) | `npx rvf init --auth sheets` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_SPREADSHEET_ID` | ~3.5 min | OAuth loopback + PKCE; auto-creates a new spreadsheet via Drive API |
| **supabase** table | `npx rvf init --auth supabase` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ~3 min | lists your projects via Management API, auto-fetches the service-role key. **Run the `CREATE TABLE` SQL in [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) once.** |
| **jira** Cloud | `npx rvf init --auth jira` | `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` | ~3 min | deep-links `id.atlassian.com/.../api-tokens`, sniffs your email from `git config`, validates against `/myself` + `/project/{KEY}` |

Or pick interactively: `npx rvf` (no args).

You can also chain multiple destinations into one config — the CLI's interactive `init` lets you select with space, or non-interactively:

```bash
npx rvf init --destinations=local,github,slack,supabase --yes
# Then run `npx rvf auth <name>` for each one to fill env vars.
```

When you submit feedback, the widget fans out to **every** destination in parallel. The toast shows per-destination status chips (✓ or ⚠).

---

## 🤖 For AI agents

Verbatim instructions an LLM coding assistant can follow. Pick the destination from the table above, swap it into Step 1.

```text
Task: integrate react-visual-feedback into this React project.

Step 1. Run from the project root (pick a destination — github / linear /
        slack / discord / notion / hubspot / sheets / supabase / jira):

          npx rvf init --auth <destination> --yes

        This single command auto-detects the framework (Next App Router,
        Pages Router, Vite, Express), writes feedback.config.ts, writes
        the catch-all API route, opens the provider's token page in the
        browser, then writes the env vars to .env.local.

Step 2. Open the file that wraps the app:
          · Next App Router → app/layout.tsx
          · Next Pages Router → src/pages/_app.tsx
          · Vite → src/main.tsx
          · CRA → src/App.tsx
        Wrap children with:

          import feedbackConfig from './feedback.config'
          import { FeedbackProvider } from 'react-visual-feedback'
          <FeedbackProvider {...feedbackConfig}>{children}</FeedbackProvider>

        For Next Pages Router, also use dynamic({ ssr: false }) to skip
        SSR — styled-components doesn't tolerate SSR without setup.

Step 3. Supabase only: run the CREATE TABLE SQL in
        docs/SUPABASE_SETUP.md (one time). Other destinations need no
        extra setup beyond Step 1.

Step 4. Tell the user to restart `npm run dev` (env-var changes don't
        hot-reload) and press Alt+A in the browser to submit feedback.

Step 5. Verify with:  npx rvf doctor

Public exports:
  - react-visual-feedback             → FeedbackProvider, defineConfig, connect
  - react-visual-feedback/config      → defineConfig
  - react-visual-feedback/destinations → connect.*, local, githubIssue, …
  - react-visual-feedback/server      → createFeedbackHandler, devSessionAuth

Import rule: in feedback.config.ts, import defineConfig from
'react-visual-feedback/config' and connect from
'react-visual-feedback/destinations'. NOT from the root entry — the
root entry pulls the full UI bundle (React + html2canvas) and crashes
Node when the catch-all API route imports the config file.
```

The CLI is the source of truth for env-var names — never edit `.env.local` by hand. To switch destinations later, run `npx rvf auth <name>` again or `npx rvf add <name>`.

---

## 🚀 Or: try it with no server, no env vars

```jsx
<FeedbackProvider dashboard>{children}</FeedbackProvider>
```

Feedback lives in `localStorage`. `Alt+A` to capture, `Alt+Q` to see what's been reported. Useful for: solo demos, "does this widget feel right", or showing teammates.

To view the local feedback from any browser without re-mounting React,
serve `node_modules/react-visual-feedback/dist/viewer.html` (or copy it
to your `public/` folder). It live-reads `localStorage`, supports
status changes + deletion, and needs no build / server / install.

### Wiring to your own backend (`dataSource`)

For team setups, point the provider at your API:

```jsx
<FeedbackProvider
  dashboard
  dataSource={{
    load:      () => fetch('/api/feedback').then(r => r.json()),
    save:      (item) => fetch('/api/feedback', { method: 'POST', body: JSON.stringify(item) }),
    remove:    (id) => fetch(`/api/feedback/${id}`, { method: 'DELETE' }),
    subscribe: (cb) => { /* optional: SSE / WebSocket */ return () => {}; },
  }}
/>
```

`dataSource` and destinations work together — destinations fan-out at
submit-time, `dataSource` keeps the dashboard's list in sync.

## Wiring a single destination by hand (advanced)

When you don't want the catch-all router and would rather mount one
destination handler at one path, use `withSecureDefaults` + the specific
factory directly:

```js
// Server (Next.js App Router: app/api/feedback/jira/route.js)
import {
  withSecureDefaults,
  createJiraHandler,
  FeedbackAuthError,
} from 'react-visual-feedback/server';
import { getServerSession } from '@/lib/auth';

export const POST = withSecureDefaults({
  authorize: async (req) => {
    const session = await getServerSession(req);
    if (!session) throw new FeedbackAuthError();
    return { userId: session.userId, projectId: session.projectId };
  },
})(createJiraHandler({ projectKey: 'BUG' }));
```

`withSecureDefaults` enforces origin allowlist, CSRF check, rate limit,
your `authorize` callback, validation, redaction of sensitive headers/keys,
and opaque error normalization — all in a fixed order with sane defaults.
Read the **[Production Security Checklist](docs/production-security-checklist.md)** before deploying.

Examples: [Next.js (secure session + anonymous capture)](example-nextjs/), [minimal Express](example-express/).

## UI primitives (v2.3+)

Phase B1 ships a shared design-token system and ten primitives you can
use to build dashboards on top of the captured feedback data without
relying on the bundled overlay UI. Single import:

```js
import {
  Button, IconButton, Field, Select, Chip, Surface, Stack,
  Tooltip, Spinner, Avatar, AvatarStack,
} from 'react-visual-feedback/ui';
```

Wrap your app in `<UIThemeProvider mode="light">` (or `mode="dark"`)
from `react-visual-feedback/ui` to apply the warm-stone / warm-charcoal
palette. The widget's existing dashboard, modal, and dots automatically
inherit the same palette via the legacy `theme.js` keys, so no other
code change is required.

## Command Center (v2.3+)

Phase B2 ships the Command Center: a wider three-pane workspace
(Triage list · Evidence Stack · Workflow Panel) that replaces the
internals of `FeedbackDashboard`. Existing consumers don't need any
code change — `<FeedbackProvider dashboard={true}>` continues to
work and now opens the Command Center.

Direct import:

```js
import { FeedbackCommandCenter } from 'react-visual-feedback/dashboard';
```

The Command Center accepts the same prop shape as
`FeedbackDashboard` plus optional Phase A fields:
`onSeverityChange`, `onOwnerChange`, `onCustomerValueChange`,
`onIntegrationRetry`, `onDelete`, and an async `dataSource={{ load,
save, remove, subscribe }}` for hosts that want server-driven data
instead of localStorage.

Keyboard: `Esc` close · `/` focus search · `j` / `k` next-prev item.

## Features

### Feedback Collection
- **Visual Element Selection** - Click any element with hover highlighting
- **Screenshot Capture** - Automatic pixel-perfect screenshot with CSS rendering
- **Screen Recording** - Record screen with audio and capture console/network logs
- **Manual Feedback** - `Alt+A` to open form directly without selection
- **File Attachments** - Drag & drop support for Images, Videos, PDFs, and other files
- **Canvas Drawing** - Annotate screenshots with drawings and highlights
- **React Component Detection** - Automatically detects React component names and source files
- **Keyboard Shortcuts** - `Alt+Q` (Selection), `Alt+A` (Manual), `Alt+W` (Record), `Esc` (Cancel)

### Session Replay
- **Video Playback** - Watch recorded user sessions with fullscreen support
- **Console Logs** - See console.log, errors, warnings synced with video timeline
- **Network Requests** - Track API calls and responses
- **Video Mode** - Fullscreen playback with synced logs panel (scrollable even when paused)
- **Expandable Logs Panel** - Slide-out panel on the right side (customizable)

### Screen Recording
- **Draggable Indicator** - Recording overlay can be moved around the screen
- **Audio Capture** - Record microphone and system audio (mixed)
- **IndexedDB Storage** - Large videos stored locally to prevent quota errors
- **Download Videos** - Export recordings as WebM files

### Dashboard
- **Professional UI** - Clean 700px slide-out panel
- **Developer Mode** - Full technical details (source file, component stack, viewport)
- **User Mode** - Simplified view for end users
- **8 Status Options** - New, Open, In Progress, Under Review, On Hold, Resolved, Closed, Won't Fix
- **Status Callbacks** - Sync with your database on status changes
- **Search** - Search through feedback by title, description, or user

### Updates Modal
- **What's New** - Display product updates, bug fixes, and new features to users
- **Filter Tabs** - Filter by Fixed or New Feature
- **Smooth Animations** - Beautiful fade-in animations with staggered item entry
- **Mobile Responsive** - Works as a centered popup on all screen sizes
- **Dark/Light Mode** - Full theme support

### Feedback Dots (In-Context Overlay)
- **Visual Dots** - Show feedback markers directly on the page at the exact position where feedback was submitted
- **Avatar Markers** - User profile pictures or initial fallbacks with type-colored pips
- **Mini Card on Hover** - Rich preview card with avatar, name, time, type, and feedback preview
- **Detail Popover on Click** - Full feedback details with component info, source file, StatusBadge, and screenshot
- **Dot Clustering** - Nearby dots collapse into a count badge, hover to fan out
- **Filter Toolbar** - Filter dots by type (Bug/Feature/Improvement) and status (Open/Resolved)
- **Element Highlighting** - Hovering a dot highlights the original element with a pulsing border
- **Smart Positioning** - Popovers auto-flip to avoid viewport edges
- **Keyboard Navigation** - Tab through dots, Enter to open, Escape to close
- **Responsive** - Dot positions stored as percentages (0-1) relative to the element, works across screen sizes
- **Backend Data Support** - Pass feedback data from your API via props, auto-normalizes DB field formats
- **Dynamic Updates** - Data arriving late (e.g., from async API calls) updates dots in real-time

### Theming
- **Light/Dark Mode** - Full theme support
- **styled-components** - No external CSS required

## Installation

```bash
npm install react-visual-feedback
```

**Peer Dependencies:**
```bash
npm install react react-dom styled-components
```

## Quick Start

### Basic Usage

```jsx
import React from 'react';
import { FeedbackProvider } from 'react-visual-feedback';

function App() {
  const handleFeedbackSubmit = async (feedbackData) => {
    console.log('Feedback received:', feedbackData);
    // feedbackData.attachment contains any manually uploaded file
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });
  };

  return (
    <FeedbackProvider onSubmit={handleFeedbackSubmit}>
      <YourApp />
    </FeedbackProvider>
  );
}
```

### With Dashboard & Screen Recording

```jsx
import React from 'react';
import { FeedbackProvider, useFeedback } from 'react-visual-feedback';

function FeedbackButtons() {
  const { isActive, setIsActive, setIsDashboardOpen, startRecording } = useFeedback();

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', gap: 10 }}>
      <button onClick={() => setIsDashboardOpen(true)}>Dashboard</button>
      <button onClick={startRecording}>Record Screen</button>
      <button onClick={() => setIsActive(!isActive)}>
        {isActive ? 'Cancel' : 'Report Issue'}
      </button>
    </div>
  );
}

function App() {
  const handleFeedbackSubmit = async (feedbackData) => {
    // feedbackData contains: feedback, screenshot, video, attachment, eventLogs, elementInfo, etc.
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });
  };

  const handleStatusChange = async ({ id, status, comment }) => {
    await fetch(`/api/feedback/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment })
    });
  };

  return (
    <FeedbackProvider
      onSubmit={handleFeedbackSubmit}
      onStatusChange={handleStatusChange}
      dashboard={true}
      isDeveloper={true}
      userName="John Doe"
      userEmail="john@example.com"
      mode="light"
      defaultOpen={false} // Set to true to open feedback form on mount
    >
      <YourApp />
      <FeedbackButtons />
    </FeedbackProvider>
  );
}
```

### With Feedback Dots (In-Context Overlay)

Show feedback markers directly on the page at the exact positions where feedback was submitted.

```jsx
import React, { useState, useEffect } from 'react';
import { FeedbackProvider } from 'react-visual-feedback';

function App() {
  const [feedback, setFeedback] = useState([]);

  // Fetch feedback from your backend (data can arrive late)
  useEffect(() => {
    fetch('/api/feedback')
      .then(res => res.json())
      .then(data => setFeedback(data));
  }, []);

  return (
    <FeedbackProvider
      onSubmit={handleSubmit}
      dashboard={true}
      userName="Alice"
      userEmail="alice@example.com"
      userAvatar="https://example.com/avatar.jpg"
      showFeedbackDots={true}
      feedbackDotsData={feedback}
    >
      <YourApp />
    </FeedbackProvider>
  );
}
```

**How it works:**
1. User presses `Alt+Q`, clicks an element, submits feedback
2. The exact click position is captured as percentages (0-1) relative to the element
3. User presses `Alt+D` (or `showFeedbackDots={true}`) to see dots on the page
4. Dots appear at the exact positions with avatars, type indicators, and hover cards

**Backend data format — both formats are auto-normalized:**

```js
// Widget format (camelCase)
{ dotPosition: { relativeX: 0.43, relativeY: 0.67 }, elementInfo: { selector: "..." } }

// DB format (snake_case) — also works
{ dot_position_x: 0.43, dot_position_y: 0.67, elementinfo: "{\"selector\":\"...\"}" }
```

**Role-based visibility:**
```jsx
<FeedbackProvider
  showFeedbackDots={user.role === 'developer'}
  feedbackDotsData={user.role === 'developer' ? feedback : undefined}
>
```

## API Reference

### FeedbackProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(data) => Promise` | required | Callback when feedback is submitted |
| `onStatusChange` | `({id, status, comment}) => void` | - | Callback when status changes |
| `dashboard` | `boolean` | `false` | Enable dashboard feature |
| `dashboardData` | `Array` | - | Custom data (uses localStorage if undefined) |
| `isDeveloper` | `boolean` | `false` | Enable developer mode |
| `isUser` | `boolean` | `true` | Enable user mode |
| `userName` | `string` | `'Anonymous'` | User name |
| `userEmail` | `string` | `null` | User email |
| `userAvatar` | `string` | `null` | User profile picture URL |
| `mode` | `'light' \| 'dark'` | `'light'` | Theme mode |
| `isActive` | `boolean` | - | Controlled active state |
| `onActiveChange` | `(active) => void` | - | Callback for controlled mode |
| `defaultOpen` | `boolean` | `false` | Open manual feedback form immediately on mount |
| `showFeedbackDots` | `boolean` | `false` | Show/hide feedback dot markers on the page |
| `feedbackDotsData` | `Array` | `null` | Feedback data from your backend (auto-normalizes DB formats) |

### FeedbackDashboard Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | required | Control dashboard visibility |
| `onClose` | `() => void` | required | Callback when dashboard closes |
| `data` | `Array` | - | Feedback data (uses localStorage if undefined) |
| `isDeveloper` | `boolean` | `false` | Enable developer mode with delete |
| `isUser` | `boolean` | `true` | Enable user mode |
| `onStatusChange` | `({id, status, comment}) => void` | - | Callback when status changes |
| `mode` | `'light' \| 'dark'` | `'light'` | Theme mode |
| `isLoading` | `boolean` | `false` | Show loading state |
| `onRefresh` | `() => void` | - | Callback for refresh button |
| `title` | `string` | `'Feedback'` | Dashboard title |
| `statuses` | `object` | `DEFAULT_STATUSES` | Status configurations (label, color, icon) |
| `acceptableStatuses` | `string[]` | - | Array of status keys to show (e.g., `['open', 'resolved']`) |
| `showAllStatuses` | `boolean` | `true` | Show all statuses in filter |
| `error` | `string` | `null` | Error message to display |

### useFeedback Hook

```jsx
const {
  isActive,           // boolean - feedback mode active
  setIsActive,        // (active: boolean) => void
  setIsDashboardOpen, // (open: boolean) => void
  startRecording,     // () => void - start screen recording
  showFeedbackDots,   // boolean - feedback dots visible
  toggleFeedbackDots  // () => void - toggle feedback dots on/off
} = useFeedback();
```

### SessionReplay Props (for custom implementations)

```jsx
import { SessionReplay } from 'react-visual-feedback';

<SessionReplay
  videoSrc={videoDataUrl}      // Video source (data URL, blob URL, or http URL)
  eventLogs={logs}             // Array of log objects with timestamp
  mode="light"                 // Theme mode
  showLogsButton={true}        // Show/hide logs toggle button
  logsPanelWidth="320px"       // Width of logs panel
  defaultLogsOpen={false}      // Start with logs panel open
/>
```

### UpdatesModal Props

Display product updates, bug fixes, and new features to your users with a beautiful modal.

```jsx
import { UpdatesModal } from 'react-visual-feedback';

const updates = [
  {
    id: '1',
    type: 'solved',           // 'solved' | 'new_feature'
    title: 'Fixed login page performance issues',
    description: 'Optimized the authentication flow, reducing load time by 40%',
    date: '2024-11-30',
    version: '2.1.0',
    category: 'Performance'
  },
  {
    id: '2',
    type: 'new_feature',
    title: 'Dark mode support added',
    description: 'Full dark mode support across all components with smooth transitions',
    date: '2024-11-28',
    version: '2.1.0',
    category: 'Feature'
  }
];

<UpdatesModal
  isOpen={showUpdates}         // Control visibility
  onClose={() => setShowUpdates(false)}
  updates={updates}            // Array of update objects
  title="What's New"           // Modal title (default: "What's New")
  mode="light"                 // Theme mode: 'light' | 'dark'
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | required | Control modal visibility |
| `onClose` | `() => void` | required | Callback when modal closes |
| `updates` | `Update[]` | `[]` | Array of update objects |
| `title` | `string` | `"What's New"` | Modal header title |
| `mode` | `'light' \| 'dark'` | `'light'` | Theme mode |

#### Update Object Structure

```typescript
interface Update {
  id: string;                  // Unique identifier
  type: 'solved' | 'new_feature';  // Update type
  title: string;               // Update title
  description?: string;        // Optional description
  date?: string;               // Date string (displayed as "Mon DD")
  version?: string;            // Version number (displayed as "vX.X.X")
  category?: string;           // Category tag
}
```

## Data Structures

### Feedback Data (submitted via onSubmit)

```typescript
interface FeedbackData {
  id: string;                    // UUID
  feedback: string;              // User's feedback text
  type: 'bug' | 'feature' | 'improvement' | 'question' | 'other';
  userName: string;
  userEmail: string | null;
  status: string;                // 'new', 'open', 'inProgress', etc.
  timestamp: string;             // ISO 8601
  url: string;                   // Page URL
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };

  // User
  userAvatar?: string;           // Profile picture URL

  // Dot position (for feedback dots overlay)
  dotPosition?: {
    relativeX: number;           // 0-1 click position within element (horizontal)
    relativeY: number;           // 0-1 click position within element (vertical)
  };

  // Attachments
  screenshot?: string;           // Base64 PNG data URL (Automatic)
  video?: string;                // Base64 webm data URL (Recording)
  attachment?: File;             // Generic file (Manual Upload)

  eventLogs?: EventLog[];        // Console/network logs

  // Element info (for element selection)
  elementInfo?: {
    tagName: string;
    id: string;
    className: string;
    selector: string;
    text: string;
    position: { x: number; y: number; width: number; height: number };
    styles: { backgroundColor: string; color: string; fontSize: string };
    sourceFile?: string;         // React source file path
    lineNumber?: number;
    columnNumber?: number;
    componentStack?: string[];   // React component hierarchy
  };
}

interface EventLog {
  timestamp: number;             // Milliseconds from recording start
  type: 'log' | 'warn' | 'error' | 'info' | 'network';
  message: string;
  data?: any;
}
```

## Database Schema (SQL)

### PostgreSQL

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main feedback table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'bug' CHECK (type IN ('bug', 'feature', 'improvement', 'question', 'other')),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'open', 'inProgress', 'underReview', 'onHold', 'resolved', 'closed', 'wontFix')),

    -- User info
    user_name VARCHAR(255) DEFAULT 'Anonymous',
    user_email VARCHAR(255),

    -- Page context
    url TEXT,
    user_agent TEXT,
    viewport_width INTEGER,
    viewport_height INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Screenshots table (separate for large data)
CREATE TABLE feedback_screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    screenshot TEXT NOT NULL,  -- Base64 encoded PNG
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Videos table (for screen recordings)
CREATE TABLE feedback_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    video_data TEXT,           -- Base64 encoded webm (for small videos)
    video_url TEXT,            -- URL to cloud storage (for large videos)
    duration_ms INTEGER,
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Generic attachments table
CREATE TABLE feedback_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    file_data TEXT,            -- Base64 or URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event logs table (console logs, network requests)
CREATE TABLE feedback_event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    timestamp_ms INTEGER NOT NULL,  -- Milliseconds from recording start
    log_type VARCHAR(20) NOT NULL CHECK (log_type IN ('log', 'warn', 'error', 'info', 'network')),
    message TEXT NOT NULL,
    data JSONB,                     -- Additional log data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Element info table (for element selection feedback)
CREATE TABLE feedback_element_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    tag_name VARCHAR(50),
    element_id VARCHAR(255),
    class_name TEXT,
    css_selector TEXT,
    inner_text TEXT,
    position_x INTEGER,
    position_y INTEGER,
    width INTEGER,
    height INTEGER,
    background_color VARCHAR(50),
    color VARCHAR(50),
    font_size VARCHAR(20),

    -- React component info
    source_file TEXT,
    line_number INTEGER,
    column_number INTEGER,
    component_stack TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Status history table (track status changes)
CREATE TABLE feedback_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    comment TEXT,
    changed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_user_email ON feedback(user_email);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_type ON feedback(type);
CREATE INDEX idx_event_logs_feedback_id ON feedback_event_logs(feedback_id);
CREATE INDEX idx_event_logs_timestamp ON feedback_event_logs(timestamp_ms);
CREATE INDEX idx_status_history_feedback_id ON feedback_status_history(feedback_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### MySQL

```sql
-- Main feedback table
CREATE TABLE feedback (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback TEXT NOT NULL,
    type ENUM('bug', 'feature', 'improvement', 'question', 'other') DEFAULT 'bug',
    status ENUM('new', 'open', 'inProgress', 'underReview', 'onHold', 'resolved', 'closed', 'wontFix') DEFAULT 'new',

    -- User info
    user_name VARCHAR(255) DEFAULT 'Anonymous',
    user_email VARCHAR(255),

    -- Page context
    url TEXT,
    user_agent TEXT,
    viewport_width INT,
    viewport_height INT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_user_email (user_email),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Screenshots table
CREATE TABLE feedback_screenshots (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback_id CHAR(36) NOT NULL,
    screenshot LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Videos table
CREATE TABLE feedback_videos (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback_id CHAR(36) NOT NULL,
    video_data LONGTEXT,
    video_url TEXT,
    duration_ms INT,
    file_size_bytes BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attachments table
CREATE TABLE feedback_attachments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback_id CHAR(36) NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    file_data LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event logs table
CREATE TABLE feedback_event_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback_id CHAR(36) NOT NULL,
    timestamp_ms INT NOT NULL,
    log_type ENUM('log', 'warn', 'error', 'info', 'network') NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
    INDEX idx_feedback_id (feedback_id),
    INDEX idx_timestamp (timestamp_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Element info table
CREATE TABLE feedback_element_info (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback_id CHAR(36) NOT NULL,
    tag_name VARCHAR(50),
    element_id VARCHAR(255),
    class_name TEXT,
    css_selector TEXT,
    inner_text TEXT,
    position_x INT,
    position_y INT,
    width INT,
    height INT,
    background_color VARCHAR(50),
    color VARCHAR(50),
    font_size VARCHAR(20),
    source_file TEXT,
    line_number INT,
    column_number INT,
    component_stack JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Status history table
CREATE TABLE feedback_status_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    feedback_id CHAR(36) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    comment TEXT,
    changed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
    INDEX idx_feedback_id (feedback_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Example API Endpoints (Node.js/Express)

```javascript
// POST /api/feedback - Submit new feedback
app.post('/api/feedback', async (req, res) => {
  const { feedback, type, userName, userEmail, url, userAgent,
          viewport, screenshot, video, attachment, eventLogs, elementInfo } = req.body;

  // Start transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert main feedback
    const feedbackResult = await client.query(`
      INSERT INTO feedback (feedback, type, user_name, user_email, url, user_agent, viewport_width, viewport_height)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [feedback, type, userName, userEmail, url, userAgent, viewport?.width, viewport?.height]);

    const feedbackId = feedbackResult.rows[0].id;

    // Insert screenshot if exists
    if (screenshot) {
      await client.query(`
        INSERT INTO feedback_screenshots (feedback_id, screenshot)
        VALUES ($1, $2)
      `, [feedbackId, screenshot]);
    }

    // Insert video if exists
    if (video) {
      await client.query(`
        INSERT INTO feedback_videos (feedback_id, video_data)
        VALUES ($1, $2)
      `, [feedbackId, video]);
    }
    
    // Insert manual attachment (generic file)
    if (attachment) {
       // Note: 'attachment' here is assumed to be pre-processed/uploaded file metadata + content
       // In a real app, you might handle file upload separately (multipart/form-data)
       await client.query(`
        INSERT INTO feedback_attachments (feedback_id, file_name, file_data)
        VALUES ($1, $2, $3)
      `, [feedbackId, attachment.name, attachment.data]);
    }

    // Insert event logs if exist
    if (eventLogs?.length) {
      for (const log of eventLogs) {
        await client.query(`
          INSERT INTO feedback_event_logs (feedback_id, timestamp_ms, log_type, message, data)
          VALUES ($1, $2, $3, $4, $5)
        `, [feedbackId, log.timestamp, log.type, log.message, JSON.stringify(log.data)]);
      }
    }

    // Insert element info if exists
    if (elementInfo) {
      await client.query(`
        INSERT INTO feedback_element_info
        (feedback_id, tag_name, element_id, class_name, css_selector, inner_text,
         position_x, position_y, width, height, source_file, line_number, column_number, component_stack)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [feedbackId, elementInfo.tagName, elementInfo.id, elementInfo.className,
          elementInfo.selector, elementInfo.text, elementInfo.position?.x, elementInfo.position?.y,
          elementInfo.position?.width, elementInfo.position?.height, elementInfo.sourceFile,
          elementInfo.lineNumber, elementInfo.columnNumber, elementInfo.componentStack]);
    }

    await client.query('COMMIT');
    res.json({ success: true, id: feedbackId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/feedback/:id/status - Update status
app.patch('/api/feedback/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, comment, changedBy } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current status
    const current = await client.query('SELECT status FROM feedback WHERE id = $1', [id]);
    const oldStatus = current.rows[0]?.status;

    // Update status
    await client.query('UPDATE feedback SET status = $1 WHERE id = $2', [status, id]);

    // Record history
    await client.query(`
      INSERT INTO feedback_status_history (feedback_id, old_status, new_status, comment, changed_by)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, oldStatus, status, comment, changedBy]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Q` | Activate feedback mode (element selection) |
| `Alt+A` | Open Manual Feedback form |
| `Alt+W` | Start screen recording |
| `Alt+D` | Toggle feedback dots overlay |
| `Alt+Shift+Q` | Open dashboard |
| `Esc` | Cancel/close |

## Status System

### Default Statuses

| Key | Label | Color | Icon |
|-----|-------|-------|------|
| `new` | New | Purple (#8b5cf6) | Inbox |
| `open` | Open | Amber (#f59e0b) | AlertCircle |
| `inProgress` | In Progress | Blue (#3b82f6) | Play |
| `underReview` | Under Review | Cyan (#06b6d4) | Eye |
| `onHold` | On Hold | Gray (#6b7280) | PauseCircle |
| `resolved` | Resolved | Green (#10b981) | CheckCircle |
| `closed` | Closed | Slate (#64748b) | Archive |
| `wontFix` | Won't Fix | Red (#ef4444) | Ban |

### Custom Statuses

You control which statuses are available. Pass your own `statuses` object and optionally `acceptableStatuses` array to control what's shown:

```jsx
import { FeedbackDashboard } from 'react-visual-feedback';

// Define your status configurations
const myStatuses = {
  open: {
    label: 'Open',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    icon: 'AlertCircle'  // Optional - defaults to AlertCircle if not provided
  },
  in_progress: {
    label: 'In Progress',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    textColor: '#1e40af',
    icon: 'Play'
  },
  resolved: {
    label: 'Resolved',
    color: '#10b981',
    bgColor: '#d1fae5',
    textColor: '#065f46',
    icon: 'CheckCircle'
  }
};

// Option 1: Show all statuses defined in myStatuses
<FeedbackDashboard
  isOpen={true}
  statuses={myStatuses}
  // ... other props
/>

// Option 2: Use acceptableStatuses to show only specific statuses
<FeedbackDashboard
  isOpen={true}
  statuses={myStatuses}
  acceptableStatuses={['open', 'resolved']}  // Only show these 2
  // ... other props
/>
```

#### Extending Default Statuses

If you want to keep the defaults and add more:

```jsx
import { DEFAULT_STATUSES } from 'react-visual-feedback';

const extendedStatuses = {
  ...DEFAULT_STATUSES,
  // Add new status
  testing: {
    key: 'testing',
    label: 'In Testing',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    textColor: '#6d28d9',
    icon: 'Bug'
  },
  // Override existing
  resolved: {
    ...DEFAULT_STATUSES.resolved,
    label: 'Fixed & Deployed'
  }
};
```

### Status Object Structure

```typescript
interface StatusConfig {
  key: string;        // Unique identifier
  label: string;      // Display name in UI
  color: string;      // Border and icon color (hex)
  bgColor: string;    // Background color (hex)
  textColor: string;  // Text color (hex)
  icon: string;       // Icon name from available icons
}
```

### Available Icons

The following icons from Lucide React are available for custom statuses:

| Icon Name | Description |
|-----------|-------------|
| `Inbox` | New items |
| `AlertCircle` | Warnings/alerts |
| `Play` | In progress |
| `Eye` | Under review |
| `PauseCircle` | Paused/on hold |
| `CheckCircle` | Completed/resolved |
| `Archive` | Archived/closed |
| `Ban` | Rejected/won't fix |
| `XCircle` | Cancelled |
| `HelpCircle` | Questions |
| `Lightbulb` | Ideas/features |
| `Bug` | Bug reports |
| `Zap` | Quick actions |
| `MessageSquare` | Comments |

### Status Utility Functions

```jsx
import {
  getStatusData,       // Get status config with safe defaults
  getIconComponent,    // Get icon component from name
  normalizeStatusKey,  // Normalize status key to available options
  StatusBadge,         // Status badge component
  StatusDropdown       // Status dropdown component
} from 'react-visual-feedback';

// Get status data with fallbacks for missing properties
const statusData = getStatusData('inProgress', customStatuses);
// Returns: { key, label, color, bgColor, textColor, icon }

// Get icon component from string name
const Icon = getIconComponent('CheckCircle');
// Returns: Lucide React component

// Normalize various status formats to valid keys
const key = normalizeStatusKey('in_progress', customStatuses);
// Returns: 'inProgress'
```

### Status Key Normalization

The widget automatically normalizes various status key formats:

| Input | Normalized To |
|-------|---------------|
| `reported`, `submitted`, `pending` | `new` |
| `doing`, `in_progress` | `inProgress` |
| `review`, `under_review` | `underReview` |
| `hold`, `on_hold`, `paused` | `onHold` |
| `done`, `fixed`, `completed` | `resolved` |
| `archived` | `closed` |
| `rejected`, `wont_fix`, `cancelled` | `wontFix` |

## Next.js Usage

This package uses browser-only APIs and requires client-side rendering. Use dynamic import with `ssr: false`:

```tsx
// providers/FeedbackProviderClient.tsx
'use client';

import dynamic from 'next/dynamic';

const FeedbackProvider = dynamic(
  () => import('react-visual-feedback').then((mod) => mod.FeedbackProvider),
  { ssr: false }
);

export default function FeedbackProviderClient({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <FeedbackProvider {...props}>
      {children}
    </FeedbackProvider>
  );
}
```

Then use in your layout:

```tsx
// app/layout.tsx
import FeedbackProviderClient from './providers/FeedbackProviderClient';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <FeedbackProviderClient
          onSubmit={async (data) => {
            await fetch('/api/feedback', {
              method: 'POST',
              body: JSON.stringify(data)
            });
          }}
          dashboard={true}
          mode="light"
        >
          {children}
        </FeedbackProviderClient>
      </body>
    </html>
  );
}
```

## Browser Support

- Chrome/Edge (recommended for screen recording)
- Firefox
- Safari
- Opera

## All Exports

```jsx
import {
  // Core components
  FeedbackProvider,
  FeedbackModal,
  FeedbackDashboard,
  FeedbackTrigger,
  FeedbackDots,          // In-context feedback dot markers
  CanvasOverlay,
  UpdatesModal,          // What's New modal for updates

  // Hooks
  useFeedback,

  // Status components
  StatusBadge,
  StatusDropdown,

  // Status utilities
  getStatusData,
  getIconComponent,
  normalizeStatusKey,
  DEFAULT_STATUSES,

  // Storage utilities
  saveFeedbackToLocalStorage,

  // Theme utilities
  getTheme,
  lightTheme,
  darkTheme,

  // General utilities
  getElementInfo,
  captureElementScreenshot,
  getReactComponentInfo,
  formatPath
} from 'react-visual-feedback';
```

## Changelog

### v2.2.10
- **Added**: Feedback Dots — in-context overlay that shows feedback markers directly on the page
- **Added**: `showFeedbackDots` prop and `Alt+D` keyboard shortcut to toggle dots
- **Added**: `feedbackDotsData` prop to pass feedback from backend APIs (auto-normalizes DB formats)
- **Added**: `userAvatar` prop for user profile pictures on dots and feedback data
- **Added**: `dotPosition` field auto-captured on element click (relative position 0-1, responsive across screen sizes)
- **Added**: Mini card on dot hover — avatar, name, time, type pill, 2-line preview, component chip
- **Added**: Premium popover on dot click — header with avatar/name/email, hero text, component/file chips, StatusBadge, screenshot with zoom
- **Added**: Dot clustering — nearby dots collapse into count badges, hover to fan out
- **Added**: Filter toolbar — fixed bottom-center bar with type and status filters
- **Added**: Element highlighting on dot hover — pulsing colored border around the original element
- **Added**: Keyboard navigation — Tab through dots, Enter/Space to open, Escape to close
- **Added**: Smart viewport-aware positioning for popovers and mini cards
- **Added**: Console diagnostics for debugging data format issues
- **Added**: `FeedbackDots` standalone component export
- **Added**: `toggleFeedbackDots` and `showFeedbackDots` in `useFeedback()` hook
- **Improved**: Dots always mounted (data loads in background), reactive to late-arriving prop data

### v2.2.0
- **Added**: `UpdatesModal` component - Display product updates, bug fixes, and new features
- **Added**: Draggable recording indicator - Move the recording overlay anywhere on screen
- **Added**: Video Mode with fullscreen playback and synced logs panel
- **Added**: Search functionality in feedback dashboard
- **Added**: IndexedDB storage for large video recordings (prevents quota errors)
- **Added**: Video download/export functionality
- **Improved**: Logs panel now scrollable when video is paused
- **Improved**: Audio mixing for microphone and system audio in recordings
- **Fixed**: Mobile responsive UpdatesModal - displays as centered popup

### v2.1.0
- **Added**: Manual feedback mode (`Alt+A`) - open form without selecting an element
- **Added**: `defaultOpen` prop to automatically open form on mount
- **Added**: Drag & Drop file upload support
- **Added**: Support for generic file attachments (PDF, etc.)
- **Improved**: Dark mode colors for better contrast and readability
- **Improved**: Dashboard status badges now have solid backgrounds for better visibility
- **Improved**: Screenshot preview in dashboard with zoom overlay

### v1.4.2
- **Fixed**: Modal state not resetting after submission (was showing "Sending..." on reopen)
- **Added**: `Alt+W` keyboard shortcut for video recording
- **Improved**: Custom status documentation - clarified that users control which statuses appear
- **Fixed**: Prevented double submission by checking `isSubmitting` state

### v1.4.1
- **Fixed**: `Cannot read properties of undefined (reading 'icon')` error when status data is malformed
- **Added**: `getStatusData()` utility function for safe status access with defaults
- **Improved**: Defensive null checks in StatusBadge, StatusDropdown, and FeedbackDashboard
- **Added**: Export of status utility functions for custom implementations

### v1.4.0
- **Added**: Screen recording with session replay
- **Added**: Console and network log capture during recording
- **Added**: Session replay component with expandable logs panel
- **Improved**: Dashboard UI with video playback support

### v1.3.0
- **Added**: Canvas drawing and annotation support
- **Added**: Download all feedback as ZIP

### v1.2.0
- **Added**: Custom status configurations
- **Added**: Status normalization for various formats

### v1.1.0
- **Added**: Dark mode support
- **Added**: Developer/User mode views

### v1.0.0
- Initial release with element selection and screenshot capture

## License

MIT

## Author

**Murali Vvrsn Gurajapu**
Email: murali.g@hyperverge.co

---

Made with care for better user feedback collection
