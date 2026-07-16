export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackType = 'bug' | 'idea' | 'praise' | 'question' | 'other';
export type FeedbackAuthMode = 'none' | 'session' | 'bearer' | 'signed';
export type FeedbackErrorCode =
  | 'unauthorized' | 'forbidden' | 'csrf_failed' | 'origin_blocked'
  | 'rate_limited' | 'validation_failed' | 'payload_too_large'
  | 'integration_failed' | 'integration_unavailable' | 'redacted_blocked'
  | 'server_error';

export interface FeedbackOwner {
  id?: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface FeedbackIntegrationState {
  local?:  { status: 'saved' | 'pending' | 'error'; error?: string };
  jira?:   { status: 'not_sent' | 'pending' | 'created' | 'synced' | 'error';
             issueKey?: string; issueUrl?: string; error?: string };
  sheets?: { status: 'not_sent' | 'pending' | 'appended' | 'synced' | 'error';
             rowId?: string; error?: string };
}

export interface FeedbackStatusHistoryItem {
  from?: string; to: string;
  changedBy?: string; changedAt: string;
  comment?: string;
}

export interface FeedbackSecurityContext {
  projectId?: string;
  tenantId?: string;
  submittedBy?: { id?: string; role?: string };
  authMode?: FeedbackAuthMode;
  redactionApplied?: boolean;
  captureConsent?: 'implicit' | 'explicit';
}

export interface FeedbackAuthConfig {
  mode: FeedbackAuthMode;
  getToken?: () => string | null | Promise<string | null>;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  csrfToken?: string | (() => string | null | Promise<string | null>);
  retryOnUnauthorized?: boolean;
}

export interface FeedbackRedactionConfig {
  preset?: 'default' | 'strict';
  redactHeaders?: string[];
  redactHeaderPrefixes?: string[];
  redactQueryParams?: string[];
  redactBodyKeys?: string[];
  maxBodyLength?: number;
  maxLogMessageLength?: number;
  allowRequestBodies?: boolean;
  allowResponseBodies?: boolean;
  stripUrlQuery?: boolean;
  dropStorageValues?: boolean;
  dropIndexedDbEvents?: boolean;
}

export interface AuthorizedFeedbackContext {
  userId?: string;
  projectId?: string;
  tenantId?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Normalized request shape passed to `authorize` and other hooks.
 *
 * - Use `cookies['name']` for cookie reads (already parsed).
 * - Use `headers['name']` for headers (already lowercased).
 * - Use `raw` to fall back to the underlying Next.js / Express / Web Request.
 *
 * Do NOT call `req.headers.get(...)` — `headers` is a plain object, not a
 * Web Headers instance. That call returns undefined silently and is the
 * single most common integration bug. The type below makes the correct
 * shape explicit so this misuse becomes a compile error.
 */
export interface FeedbackRequestLike {
  method: string;
  url: string;
  origin: string | null;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  ip: string | null;
  /** Underlying request: Next.js Request, Express req, or Web Request. */
  raw: unknown;
  readBody: () => Promise<unknown>;
}

export interface FeedbackServerSecurityHooks {
  authorize: (req: FeedbackRequestLike) => Promise<AuthorizedFeedbackContext>;
  validateOrigin?: (req: FeedbackRequestLike) => boolean | Promise<boolean>;
  rateLimit?: (req: FeedbackRequestLike, ctx: AuthorizedFeedbackContext) => Promise<void>;
  redactFeedback?: (feedback: unknown, ctx: AuthorizedFeedbackContext) => Promise<unknown>;
  resolveIntegrationSecrets?: (ctx: AuthorizedFeedbackContext) => Promise<Record<string, unknown>>;
  errorNormalizer?: (err: unknown, ctx?: AuthorizedFeedbackContext) => unknown;
}

export type FeedbackServerResponse<T = unknown> =
  | { ok: true; data: T; securityContext: FeedbackSecurityContext }
  | { ok: false; error: FeedbackErrorCode; message?: string; fields?: Record<string, string> };

// =====================================================================
// React component types (Phase D / T34 — first TS-first slice)
// =====================================================================

import type { ReactNode, FC } from 'react';

export type FeedbackPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface FeedbackBuildInfo {
  commit?: string;
  branch?: string;
  builtAt?: string;
  environment?: string;
  packageVersion?: string;
  [key: string]: unknown;
}

export interface FeedbackCaptureConfig {
  buildInfo?: FeedbackBuildInfo;
  flagsSnapshot?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
  sensitiveSelectors?: string[];
  interactionBufferSize?: number;
  networkBufferSize?: number;
  networkExcludePatterns?: string[];
  disableNetworkCapture?: boolean;
  disableVitals?: boolean;
  disableMutations?: boolean;
  /** Compress screenshots in-browser before submit. WebP @ 0.85 default. */
  media?: {
    compress?: boolean;
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number;
    maxDimension?: number | null;
  };
  /** Phase G tier 3 — direct-to-storage upload. When set, browser PUTs
   *  binaries straight to S3/R2/Supabase via short-lived signed URLs. */
  upload?: {
    strategy?: 'json' | 'multipart' | 'signed-url';
    endpoint?: string;
  };
}

export interface FeedbackNetworkEntry {
  type: 'fetch' | 'xhr';
  method: string;
  url: string;
  origin: string | null;
  status: number | null;
  ok: boolean | null;
  duration: number;
  error?: string;
  ts: number;
}

export interface FeedbackPayload {
  feedback: string;
  type: FeedbackType;
  severity?: FeedbackPriority | FeedbackSeverity;
  labels?: string[];
  screenshot?: string | null;
  videoBlob?: Blob | null;
  attachment?: File | null;
  eventLogs?: unknown[];
  timestamp: string;
  url: string;
  component?: string;
  elementInfo?: unknown;
  userAgent: string;
  viewport: { width: number; height: number };
  userName: string;
  userEmail?: string | null;
  userAvatar?: string | null;
  selectedIntegrations?: { local?: boolean; jira?: boolean; sheets?: boolean };
  dotPosition?: { x: number; y: number } | null;
  aiTicket?: {
    markdown: string;
    json: Record<string, unknown>;
    assembledOn: 'worker' | 'main';
  };
}

export interface SimpleFeedbackButtonProps {
  /** Required: handler invoked with the assembled FeedbackPayload on submit. */
  onSubmit: (payload: FeedbackPayload) => void | Promise<void>;
  /** Reporter display name. Default 'Anonymous'. */
  userName?: string;
  /** Reporter email — improves Jira/ticket attribution. */
  userEmail?: string | null;
  /** Trigger button position. Default 'bottom-right'. */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Optional build metadata threaded into the AI ticket. */
  buildInfo?: FeedbackBuildInfo;
  /** Optional feature-flag snapshot function — invoked at submit time. */
  flagsSnapshot?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
  children?: ReactNode;
}

export interface FeedbackProviderProps {
  onSubmit?: (payload: FeedbackPayload) => void | Promise<void>;
  onStatusChange?: (input: { id: string; status: string; comment?: string }) => void | Promise<void>;
  dashboard?: boolean;
  isDeveloper?: boolean;
  userName?: string;
  userEmail?: string | null;
  userAvatar?: string | null;
  mode?: 'light' | 'dark';
  auth?: FeedbackAuthConfig;
  redact?: 'default' | 'strict' | 'off' | FeedbackRedactionConfig;
  captureConfig?: FeedbackCaptureConfig;
  integrations?: {
    jira?: Record<string, unknown>;
    sheets?: Record<string, unknown>;
  };
  onIntegrationSuccess?: (type: string, result: unknown) => void;
  onIntegrationError?: (type: string, error: unknown) => void;
  enableMobileFeedback?: boolean;
  triggerBottom?: number;
  triggerRight?: number;
  children?: ReactNode;
}

export const SimpleFeedbackButton: FC<SimpleFeedbackButtonProps>;
export const FeedbackProvider: FC<FeedbackProviderProps>;

// =====================================================================
// Phase E — destinations adapter system
// =====================================================================

export type FeedbackDestinationMode = 'local' | 'public-token' | 'server-proxied';

export interface FeedbackDestinationResult {
  name: string;
  mode?: FeedbackDestinationMode;
  describe?: string;
  ok: boolean;
  id?: string | null;
  url?: string | null;
  error?: string;
  code?: string;
  durationMs: number;
}

export interface FeedbackDestination {
  name: string;
  mode: FeedbackDestinationMode;
  describe?: () => string;
  send: (feedback: FeedbackPayload, ctx?: Record<string, unknown>) =>
    Promise<Omit<FeedbackDestinationResult, 'name' | 'mode' | 'describe'>>;
}

// Adapter factories — from react-visual-feedback/destinations
export function local(opts?: { namespace?: string }): FeedbackDestination;
export function webhook(opts: { url: string; headers?: Record<string, string>; name?: string }): FeedbackDestination;
export function webhookProxied(opts?: { endpoint?: string; name?: string }): FeedbackDestination;
export function supabasePublic(opts: { url: string; anonKey: string; table?: string }): FeedbackDestination;
export function supabaseProxied(opts?: { endpoint?: string }): FeedbackDestination;
export function linearIssue(opts?: { endpoint?: string }): FeedbackDestination;
export function githubIssue(opts?: { endpoint?: string; repo?: string }): FeedbackDestination;
export function githubAction(opts?: { endpoint?: string }): FeedbackDestination;
export function notionDb(opts?: { endpoint?: string }): FeedbackDestination;
export function cloud(opts: { projectId: string; ingestToken: string; ingestUrl?: string }): FeedbackDestination;

export class FeedbackCredentialLeakError extends Error {
  code: 'private_credential_in_bundle';
  detectedAs: string;
  fieldName: string;
}
export function assertNoPrivateCredentials(value: unknown, fieldName: string): void;
export function detectPrivateCredential(value: unknown): string | null;

// =====================================================================
// Phase F — shared config + catch-all router
// =====================================================================

export interface FeedbackConfig {
  destinations?: FeedbackDestination[];
  auth?: FeedbackAuthConfig;
  redact?: 'default' | 'strict' | 'off' | FeedbackRedactionConfig;
  ui?: {
    variant?: 'centered' | 'drawer' | 'compact' | 'stepper' | 'two-column' | 'workspace';
    accent?: string;
  };
  /** Override the auto-mapping for specific destination names. */
  routes?: Record<string, (req: any, res?: any) => Promise<unknown>>;
  /** Security wrapper options forwarded to withSecureDefaults. */
  security?: Record<string, unknown>;
  onDestinationResults?: (results: FeedbackDestinationResult[]) => void;
}

/**
 * Single source of truth for both browser and server. The same file is
 * imported by `<FeedbackProvider {...config} />` and by
 * `createFeedbackRouter(config)`.
 */
export function defineConfig(config: FeedbackConfig): FeedbackConfig;

/**
 * Authorize callback. Throw FeedbackAuthError to reject.
 */
export type FeedbackAuthorize = (req: any) => Promise<AuthorizedFeedbackContext>;

/**
 * Catch-all server handler that auto-dispatches to the right
 * createXHandler based on URL last-segment ↔ adapter.name.
 *
 *   // app/api/feedback/[...rest]/route.ts
 *   export const POST = createFeedbackRouter({
 *     ...feedbackConfig,
 *     authorize: async (req) => { ... },
 *   })
 */
export function createFeedbackRouter(
  config: FeedbackConfig & { authorize?: FeedbackAuthorize }
): (req: any, res?: any) => Promise<unknown>;

// Framework-agnostic capture/core surface
export interface RingBuffer<T> {
  push(item: T): void;
  snapshot(): T[];
  size(): number;
  capacity(): number;
  clear(): void;
}

export function createRingBuffer<T = unknown>(capacity?: number): RingBuffer<T>;
export function mountInteractionObserver(
  buffer: RingBuffer<unknown>,
  opts?: { sensitiveSelectors?: string[] }
): () => void;
export function mountNetworkObserver(
  buffer: RingBuffer<FeedbackNetworkEntry>,
  opts?: { excludePatterns?: string[] }
): () => void;
export function mountRouteObserver(buffer: RingBuffer<unknown>): () => void;
export function mountErrorObserver(buffer: RingBuffer<unknown>): () => void;

