/**
 * Google Sheets Integration Server Handler
 *
 * Supports:
 * - Service Account authentication (recommended for servers)
 * - OAuth 2.0 with automatic token refresh
 * - Google Apps Script (no server needed)
 *
 * Usage (Next.js App Router):
 *   export { POST } from 'react-visual-feedback/server/sheets';
 *
 * Usage (Express):
 *   app.post('/api/sheets', sheetsHandler({ spreadsheetId: '...' }));
 */

import {
  feedbackToSheetRow,
  getSheetHeaders,
  mergeSheetColumns,
  DEFAULT_SHEET_COLUMN_ORDER
} from './config.js';

// ============================================
// GOOGLE SHEETS CLIENT (Service Account)
// ============================================

class SheetsClient {
  constructor(config) {
    this.spreadsheetId = config.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    this.sheetName = config.sheetName || 'Feedback';

    // Service Account credentials
    const credentials = config.credentials || process.env.GOOGLE_SERVICE_ACCOUNT;

    if (!credentials) {
      throw new Error(
        'Google credentials missing. Set GOOGLE_SERVICE_ACCOUNT environment variable.'
      );
    }

    this.credentials = typeof credentials === 'string'
      ? JSON.parse(credentials)
      : credentials;

    if (!this.spreadsheetId) {
      throw new Error(
        'Spreadsheet ID missing. Set GOOGLE_SPREADSHEET_ID environment variable.'
      );
    }

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token using Service Account JWT
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const { client_email, private_key } = this.credentials;

    // Create JWT
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const jwt = await this.createJWT(header, payload, private_key);

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early

    return this.accessToken;
  }

  /**
   * Create JWT for Service Account auth
   */
  async createJWT(header, payload, privateKey) {
    const encoder = new TextEncoder();

    const headerB64 = this.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = this.base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Import private key
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = privateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');

    const binaryKey = Buffer.from(pemContents, 'base64');

    // Use Node.js crypto for signing
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    sign.end();

    const signature = sign.sign({
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    });

    const signatureB64 = this.base64UrlEncode(signature);

    return `${signatureInput}.${signatureB64}`;
  }

  base64UrlEncode(data) {
    const str = typeof data === 'string' ? data : Buffer.from(data).toString('base64');
    return Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Make authenticated request to Sheets API
   */
  async request(endpoint, options = {}) {
    const token = await this.getAccessToken();
    const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    const response = await fetch(`${baseUrl}/${this.spreadsheetId}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sheets API error (${response.status}): ${error}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /**
   * Append row to sheet
   */
  async appendRow(values, sheetName = null) {
    const range = `${sheetName || this.sheetName}!A:Z`;

    return this.request(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({
        values: [values],
        majorDimension: 'ROWS'
      })
    });
  }

  /**
   * Get sheet values
   */
  async getValues(range) {
    return this.request(`/values/${encodeURIComponent(range)}`);
  }

  /**
   * Update specific cell/range
   */
  async updateValues(range, values) {
    return this.request(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({
        values,
        majorDimension: 'ROWS'
      })
    });
  }

  /**
   * Check if headers exist, create if not
   */
  async ensureHeaders(headers) {
    try {
      const existing = await this.getValues(`${this.sheetName}!1:1`);

      if (!existing.values || existing.values.length === 0) {
        // No headers, add them
        await this.updateValues(`${this.sheetName}!A1`, [headers]);
        return { created: true };
      }

      return { created: false, existing: existing.values[0] };
    } catch (error) {
      // Sheet might not exist, try to create headers anyway
      try {
        await this.updateValues(`${this.sheetName}!A1`, [headers]);
        return { created: true };
      } catch (e) {
        throw new Error(`Failed to set up headers: ${e.message}`);
      }
    }
  }

  /**
   * Find row by feedback ID
   */
  async findRowByFeedbackId(feedbackId, idColumn = 'B') {
    const values = await this.getValues(`${this.sheetName}!${idColumn}:${idColumn}`);

    if (!values.values) return null;

    const rowIndex = values.values.findIndex(row => row[0] === feedbackId);
    return rowIndex >= 0 ? rowIndex + 1 : null; // 1-indexed
  }

  /**
   * Update feedback status in sheet
   */
  async updateStatus(feedbackId, newStatus, statusColumn = 'E') {
    const rowNumber = await this.findRowByFeedbackId(feedbackId);

    if (!rowNumber) {
      throw new Error(`Feedback ${feedbackId} not found in sheet`);
    }

    await this.updateValues(
      `${this.sheetName}!${statusColumn}${rowNumber}`,
      [[newStatus]]
    );

    return { success: true, row: rowNumber };
  }
}

// ============================================
// OAUTH CLIENT (User Authentication)
// ============================================

class SheetsOAuthClient extends SheetsClient {
  constructor(config) {
    super({ spreadsheetId: config.spreadsheetId, sheetName: config.sheetName, credentials: { client_email: '', private_key: '' } });

    this.clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = config.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    // Token storage (user must provide storage mechanism)
    this.getStoredTokens = config.getStoredTokens;
    this.saveTokens = config.saveTokens;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('OAuth configuration missing. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(state = '') {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      access_type: 'offline',
      prompt: 'consent',
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokens = await response.json();

    // Save tokens
    if (this.saveTokens) {
      await this.saveTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry: Date.now() + tokens.expires_in * 1000
      });
    }

    return tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();

    // Save new access token
    if (this.saveTokens) {
      const stored = await this.getStoredTokens();
      await this.saveTokens({
        access_token: data.access_token,
        refresh_token: stored.refresh_token, // Keep existing refresh token
        expiry: Date.now() + data.expires_in * 1000
      });
    }

    return data.access_token;
  }

  /**
   * Override getAccessToken to use OAuth
   */
  async getAccessToken() {
    if (!this.getStoredTokens) {
      throw new Error('Token storage not configured. Provide getStoredTokens and saveTokens functions.');
    }

    const stored = await this.getStoredTokens();

    if (!stored || !stored.refresh_token) {
      throw new Error('Not authenticated. User needs to complete OAuth flow.');
    }

    // Check if access token is still valid
    if (stored.access_token && stored.expiry && Date.now() < stored.expiry - 60000) {
      return stored.access_token;
    }

    // Refresh the token
    return this.refreshAccessToken(stored.refresh_token);
  }
}

// ============================================
// REFRESH-TOKEN CLIENT (CLI-onboarded OAuth)
// ============================================

/**
 * Client for the `rvf auth sheets` flow.
 *
 * The CLI walks the user through Google's consent screen once and
 * persists a long-lived refresh token to .env.local. At request time,
 * this client trades that refresh token for a fresh access token (cached
 * in memory with expiry) before every Sheets call.
 *
 * No persistence callbacks needed — refresh token is the persistent
 * unit. Uses `drive.file` scope (per-file, non-sensitive).
 */
class SheetsRefreshTokenClient extends SheetsClient {
  constructor(config) {
    // Bypass parent's service-account validation
    super({
      spreadsheetId: config.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID,
      sheetName: config.sheetName,
      credentials: { client_email: '', private_key: '' },
    });

    this.clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    this.refreshToken = config.refreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('OAuth client missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or run `npx rvf auth sheets`).');
    }
    if (!this.refreshToken) {
      throw new Error('OAuth refresh token missing. Run `npx rvf auth sheets` to generate one.');
    }
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to refresh Google access token: ${text}`);
    }
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }
}

// ============================================
// REQUEST HANDLERS
// ============================================

let _sheetsInsecureWarned = false;
function warnIfInsecure(config) {
  if (config.security || config.__suppressInsecureWarning || _sheetsInsecureWarned) return;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    _sheetsInsecureWarned = true;
    console.warn('[react-visual-feedback] createSheetsHandler() called without withSecureDefaults wrapper in production. Wrap with withSecureDefaults({ authorize }) for origin, CSRF, rate-limit, and authorization checks. See docs/production-security-checklist.md');
  }
}

/**
 * Create Sheets handler with configuration.
 *
 * Two call patterns:
 *   1. Legacy: (req, res) => Response. Parses body itself.
 *   2. Secure: (feedbackData, { authContext, securityContext }) — invoked by
 *      withSecureDefaults with already-parsed, validated, redacted data.
 */
export function createSheetsHandler(config = {}) {
  warnIfInsecure(config);

  const handler = async (req, res) => {
    // Secure path: invoked by withSecureDefaults with parsed feedbackData + ctx.
    if (res && typeof res === 'object' && res.authContext) {
      const feedbackData = req;
      const ClientClass = pickClientClass(config);
      const client = new ClientClass(config);
      const result = await handleAppend(client, feedbackData, config);
      return { data: result };
    }

    // Raw path — no withSecureDefaults wrapper. In production this means
    // the handler is exposed without origin/CSRF/authorize checks, AND
    // the OAuth exchange-code action is a token-injection magnet
    // (an attacker who can hit this endpoint logs THEIR refresh token
    // into the host's storage). Refuse in production unless the caller
    // explicitly opts in.
    if (typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'production' &&
        !config.__allowUnwrappedInProd) {
      const status = 403;
      const errorBody = {
        success: false,
        error: 'createSheetsHandler refused: unwrapped invocation in production. Wrap with withSecureDefaults({ authorize }), or pass __allowUnwrappedInProd: true if you really mean it.',
      };
      if (res?.json) { res.status(status).json(errorBody); return; }
      return new Response(JSON.stringify(errorBody), {
        status, headers: { 'content-type': 'application/json' },
      });
    }

    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action = 'append', feedbackData, feedbackId, status, row } = body;

      // Choose client type based on config
      const ClientClass = pickClientClass(config);
      const client = new ClientClass(config);

      let result;

      switch (action) {
        case 'append':
          result = await handleAppend(client, feedbackData, config);
          break;

        case 'updateStatus':
          result = await handleUpdateStatus(client, feedbackId, status, config);
          break;

        case 'updateRow':
          result = await handleUpdateRow(client, row, feedbackData, config);
          break;

        case 'getHeaders':
          result = { headers: getSheetHeaders(config) };
          break;

        case 'ensureHeaders':
          const headers = getSheetHeaders(config);
          result = await client.ensureHeaders(headers);
          break;

        // OAuth specific actions — only meaningful for the legacy
        // callback-style OAuth client. Refuse when the request didn't
        // come through withSecureDefaults to prevent token injection.
        case 'getAuthUrl':
          if (!(client instanceof SheetsOAuthClient)) {
            throw new Error('OAuth not configured');
          }
          result = { url: client.getAuthUrl(body.state) };
          break;

        case 'exchangeCode':
          if (!(client instanceof SheetsOAuthClient)) {
            throw new Error('OAuth not configured');
          }
          result = await client.exchangeCode(body.code);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Send response
      if (res?.json) {
        res.status(200).json(result);
      } else {
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error.message
      };

      if (res?.json) {
        res.status(500).json(errorResponse);
      } else {
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };

  return handler;
}

/**
 * Pick the right Sheets client class for this request.
 *
 *   1. config.refreshToken or GOOGLE_OAUTH_REFRESH_TOKEN env → CLI-onboarded
 *      OAuth (refresh-token flow). This is the path `rvf auth sheets` sets up.
 *   2. config.oauth → callback-driven OAuth (legacy)
 *   3. default → service account (the original "advanced" path)
 */
function pickClientClass(config) {
  if (config.refreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return SheetsRefreshTokenClient;
  }
  if (config.oauth) return SheetsOAuthClient;
  return SheetsClient;
}

/**
 * Handle append row
 */
async function handleAppend(client, feedbackData, config) {
  // Ensure headers exist
  const headers = getSheetHeaders(config);
  await client.ensureHeaders(headers);

  // Transform feedback to row
  const row = feedbackToSheetRow(feedbackData, config);

  // Phase C: append two columns (Markdown + JSON), truncated for cell safety.
  if (feedbackData.aiTicket) {
    row.push(
      String(feedbackData.aiTicket.markdown || '').slice(0, 4000),
      JSON.stringify(feedbackData.aiTicket.json || {}).slice(0, 4000),
    );
  }

  // Append row
  const result = await client.appendRow(row);

  return {
    success: true,
    updatedRange: result?.updates?.updatedRange,
    rowNumber: result?.updates?.updatedRange?.match(/:(\d+)$/)?.[1]
  };
}

/**
 * Handle status update
 */
async function handleUpdateStatus(client, feedbackId, status, config) {
  // Find status column
  const { columns, order } = mergeSheetColumns(config.columns, config.columnOrder);
  const statusIndex = order.indexOf('status');
  const statusColumn = String.fromCharCode(65 + statusIndex); // A, B, C...

  const result = await client.updateStatus(feedbackId, status, statusColumn);

  return result;
}

/**
 * Handle row update
 */
async function handleUpdateRow(client, rowNumber, feedbackData, config) {
  const row = feedbackToSheetRow(feedbackData, config);
  const range = `${config.sheetName || 'Feedback'}!A${rowNumber}`;

  await client.updateValues(range, [row]);

  return { success: true, row: rowNumber };
}

// ============================================
// FRAMEWORK-SPECIFIC EXPORTS
// ============================================

/**
 * Next.js App Router handler
 * Returns a function that can be directly exported as POST
 */
export function createNextAppHandler(config = {}) {
  const handler = createSheetsHandler(config);

  return async (request) => {
    const body = await request.json();
    return handler({ body }, null);
  };
}

/**
 * Next.js Pages Router handler
 */
export function createNextPagesHandler(config = {}) {
  return createSheetsHandler(config);
}

/**
 * Express middleware
 */
export function createExpressMiddleware(config = {}) {
  const handler = createSheetsHandler(config);

  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

// ============================================
// GOOGLE APPS SCRIPT TEMPLATE
// ============================================

/**
 * Returns the Google Apps Script code that users paste into their sheet
 */
export function getAppsScriptTemplate(config = {}) {
  const headers = getSheetHeaders(config);

  return `
/**
 * React Visual Feedback - Google Apps Script Handler
 *
 * Setup:
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code
 * 4. Deploy > New deployment > Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Copy the URL and use in your React app
 */

// Sheet configuration
const SHEET_NAME = '${config.sheetName || 'Feedback'}';
const HEADERS = ${JSON.stringify(headers)};

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'append';

    let result;

    switch (action) {
      case 'append':
        result = appendFeedback(data.feedbackData);
        break;
      case 'updateStatus':
        result = updateStatus(data.feedbackId, data.status);
        break;
      case 'getRows':
        result = getRows(data.limit || 100);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Feedback API ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Append feedback to sheet
 */
function appendFeedback(feedbackData) {
  const sheet = getOrCreateSheet();

  const row = [
    new Date().toISOString(),                           // Timestamp
    feedbackData.id || '',                              // ID
    feedbackData.feedback || '',                        // Feedback
    feedbackData.type || 'bug',                         // Type
    feedbackData.status || 'new',                       // Status
    feedbackData.userName || 'Anonymous',               // User Name
    feedbackData.userEmail || '',                       // User Email
    feedbackData.url || '',                             // Page URL
    feedbackData.viewport ? feedbackData.viewport.width + 'x' + feedbackData.viewport.height : '', // Viewport
    feedbackData.screenshot ? 'Yes' : 'No',             // Screenshot
    feedbackData.video ? 'Yes' : 'No',                  // Video
    feedbackData.jiraKey || ''                          // Jira Key
  ];

  sheet.appendRow(row);

  return {
    success: true,
    row: sheet.getLastRow()
  };
}

/**
 * Update feedback status
 */
function updateStatus(feedbackId, newStatus) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  // Find row with matching ID (column B, index 1)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === feedbackId) {
      // Update status (column E, index 4)
      sheet.getRange(i + 1, 5).setValue(newStatus);
      return { success: true, row: i + 1 };
    }
  }

  return { success: false, error: 'Feedback not found' };
}

/**
 * Get rows from sheet
 */
function getRows(limit) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  const rows = data.slice(1, limit + 1).map((row, index) => ({
    rowNumber: index + 2,
    timestamp: row[0],
    id: row[1],
    feedback: row[2],
    type: row[3],
    status: row[4],
    userName: row[5],
    userEmail: row[6],
    url: row[7],
    viewport: row[8],
    hasScreenshot: row[9] === 'Yes',
    hasVideo: row[10] === 'Yes',
    jiraKey: row[11]
  }));

  return { success: true, rows };
}

/**
 * Get or create the feedback sheet
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);

    // Format headers
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
  }

  return sheet;
}

/**
 * Update Jira key for a feedback item
 */
function updateJiraKey(feedbackId, jiraKey) {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === feedbackId) {
      // Update Jira key (column L, index 11)
      sheet.getRange(i + 1, 12).setValue(jiraKey);
      return { success: true, row: i + 1 };
    }
  }

  return { success: false, error: 'Feedback not found' };
}
`.trim();
}

// ============================================
// ZAPIER / WEBHOOK FORMATTERS
// ============================================

/**
 * Format feedback for Zapier webhook
 */
export function formatForZapier(feedbackData) {
  return {
    timestamp: new Date().toISOString(),
    id: feedbackData.id,
    feedback: feedbackData.feedback,
    type: feedbackData.type || 'bug',
    status: feedbackData.status || 'new',
    user_name: feedbackData.userName || 'Anonymous',
    user_email: feedbackData.userEmail || '',
    page_url: feedbackData.url || '',
    viewport: feedbackData.viewport ? `${feedbackData.viewport.width}x${feedbackData.viewport.height}` : '',
    has_screenshot: !!feedbackData.screenshot,
    has_video: !!feedbackData.video,
    element_selector: feedbackData.elementInfo?.selector || '',
    component_name: (feedbackData.elementInfo?.componentStack || [])[0] || ''
  };
}

// Default export
export default createSheetsHandler;
