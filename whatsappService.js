import crypto from 'node:crypto';
import { WhatsAppConnection, connectDB } from './db.js';

// ============================================================================
// PulseFlow WhatsApp Provider Layer
// One abstraction used for BOTH manual API configuration and Meta Embedded
// Signup connections. The AI / inbox / agent layers never talk to Meta
// directly — they resolve credentials through this module.
// ============================================================================

const GRAPH_API_VERSION = normalizeGraphVersion(
  process.env.META_GRAPH_API_VERSION || process.env.WHATSAPP_API_VERSION || 'v26.0'
);

const REQUEST_TIMEOUT_MS = 20000;

export const CONNECTION_STATUS = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR',
  DISCONNECTED: 'DISCONNECTED'
};

export const COEXISTENCE_STATUS = {
  NONE: 'NONE',
  PENDING: 'COEXISTENCE_PENDING',
  CONNECTED: 'COEXISTENCE_CONNECTED',
  NOT_ELIGIBLE: 'COEXISTENCE_NOT_ELIGIBLE'
};

function normalizeGraphVersion(raw) {
  let version = String(raw || 'v26.0')
    .trim()
    .replace(/['"]/g, '')
    .replace(/^\/+|\/+$/g, '');
  if (!version.startsWith('v')) version = `v${version}`;
  return version;
}

export function getGraphVersion() {
  return GRAPH_API_VERSION;
}

// ---------------------------------------------------------------------------
// Error type with a human-readable, token-free message for the UI
// ---------------------------------------------------------------------------
export class WhatsAppOnboardingError extends Error {
  constructor(code, userMessage, detail = '') {
    super(userMessage);
    this.name = 'WhatsAppOnboardingError';
    this.code = code;
    this.userMessage = userMessage;
    this.detail = String(detail || '').slice(0, 400);
  }
}

function sanitizeMessage(msg) {
  if (!msg) return '';
  return String(msg)
    .replace(/EAA[A-Za-z0-9]{10,}/g, '[redacted-token]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

// ---------------------------------------------------------------------------
// Credential encryption at rest (AES-256-GCM)
// ---------------------------------------------------------------------------
function getEncryptionKey() {
  const seed = (
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'pulseflow-whatsapp-crm-jwt-secret-2026'
  ).trim();
  return crypto.createHash('sha256').update(seed).digest();
}

export function encryptSecret(plainText) {
  if (!plainText) return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const ct = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  } catch (err) {
    console.warn('[whatsapp-service] credential encryption failed:', err.message);
    return '';
  }
}

export function decryptSecret(stored) {
  if (!stored) return '';
  try {
    if (!String(stored).startsWith('v1:')) return '';
    const [, ivB64, tagB64, ctB64] = String(stored).split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final()
    ]).toString('utf8');
  } catch (err) {
    console.warn('[whatsapp-service] credential decryption failed:', err.message);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Masking helpers — full IDs / phone numbers are never sent to the browser
// ---------------------------------------------------------------------------
export function maskId(value) {
  const v = String(value || '');
  if (!v) return '';
  if (v.length <= 6) return `${v.slice(0, 2)}${'•'.repeat(Math.max(2, v.length - 2))}`;
  return `${v.slice(0, 3)}${'•'.repeat(Math.max(4, v.length - 6))}${v.slice(-3)}`;
}

export function maskPhone(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const digits = v.replace(/[^0-9]/g, '');
  if (digits.length < 5) return v;
  const keepStart = digits.slice(0, Math.min(4, digits.length - 4));
  const keepEnd = digits.slice(-4);
  const visible = `${keepStart}${'•'.repeat(Math.max(2, digits.length - keepStart.length - keepEnd.length))}${keepEnd}`;
  const hasPlus = v.startsWith('+');
  return `${hasPlus ? '+' : ''}${visible}`;
}

// ---------------------------------------------------------------------------
// Meta Graph API client (server-to-server only, never called from the browser)
// ---------------------------------------------------------------------------
async function graphFetch(path, { method = 'GET', token, body, query } = {}) {
  if (!token) {
    throw new WhatsAppOnboardingError(
      'MISSING_TOKEN',
      'PulseFlow could not complete the Meta request because no valid authorization was received.'
    );
  }

  let url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${String(path).replace(/^\//, '')}`;
  if (query && Object.keys(query).length > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    if (qsStr) url += (url.includes('?') ? '&' : '?') + qsStr;
  }

  const headers = { Authorization: `Bearer ${token}` };
  const init = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    init.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  const res = await fetch(url, init);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data: data || {} };
}

function graphErrorToOnboardingError(step, result) {
  const err = result?.data?.error || {};
  const legacy = result?.data?.error_msg
    ? { message: result.data.error_msg, code: result.data.error }
    : err;
  const code = legacy?.code;
  const message = sanitizeMessage(legacy?.message || `HTTP ${result?.status}`);

  if (code === 100 || /invalid.*code|code has been used|expired/i.test(message || '')) {
    return new WhatsAppOnboardingError(
      'INVALID_AUTH_CODE',
      'Meta authorization code is invalid or has expired. Please try connecting again.',
      `${step}: ${message}`
    );
  }
  if (code === 200 || /permission|ads.*permission|requires.*review|advanced access/i.test(message || '')) {
    return new WhatsAppOnboardingError(
      'PERMISSION_DENIED',
      'Meta denied a required permission. App Review / Advanced Access for WhatsApp permissions may be required before your Meta app can onboard this business.',
      `${step}: ${message}`
    );
  }
  if (code === 190 || /invalid.*access token|expired.*token/i.test(message || '')) {
    return new WhatsAppOnboardingError(
      'TOKEN_EXCHANGE_FAILED',
      'The Meta authorization could not be validated (invalid or expired token). Please try connecting again.',
      `${step}: ${message}`
    );
  }
  if (code === 10 || /parameter.*required|callback_url/i.test(message || '')) {
    return new WhatsAppOnboardingError(
      'WEBHOOK_NOT_CONFIGURED',
      'Meta could not subscribe this WhatsApp Business Account because the webhook callback URL is not configured for your Meta app. Configure the webhook in the Meta App Dashboard and reconnect.',
      `${step}: ${message}`
    );
  }
  if ([4, 17, 32, 613].includes(code) || /rate limit|too many calls/i.test(message || '')) {
    return new WhatsAppOnboardingError(
      'RATE_LIMITED',
      'Meta is rate limiting requests right now. Wait a moment and try connecting again.',
      `${step}: ${message}`
    );
  }
  if (code === 368 || /business.*verified|verification/i.test(message || '')) {
    return new WhatsAppOnboardingError(
      'BUSINESS_VERIFICATION_REQUIRED',
      'Meta requires business verification for this account. Complete verification in Meta Business Manager → Security Center, then try again.',
      `${step}: ${message}`
    );
  }
  return new WhatsAppOnboardingError(
    'META_ERROR',
    `Meta could not complete the request: ${message || 'unknown error'}`,
    `${step}: code ${code || 'n/a'}`
  );
}

// ---------------------------------------------------------------------------
// Meta app configuration (safe to expose to the admin frontend)
// ---------------------------------------------------------------------------
export function getMetaSignupConfig() {
  const appId = (process.env.META_APP_ID || '').trim();
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  const configId = (process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '').trim();
  const webhookVerifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  const webhookAppSecret = (process.env.WHATSAPP_APP_SECRET || '').trim();
  const coexistenceEnabled = String(process.env.META_COEXISTENCE_ENABLED || 'true')
    .trim()
    .toLowerCase() !== 'false';

  const missing = [];
  if (!appId) {
    missing.push({
      key: 'META_APP_ID',
      label: 'Meta App ID is not configured on the server.',
      hint: 'Create a Business-type Meta app and set META_APP_ID in your environment.'
    });
  }
  if (!appSecret) {
    missing.push({
      key: 'META_APP_SECRET',
      label: 'Meta App Secret is not configured on the server.',
      hint: 'Copy the app secret from Meta App Dashboard → Settings → Basic and set META_APP_SECRET.'
    });
  }
  if (!configId) {
    missing.push({
      key: 'META_EMBEDDED_SIGNUP_CONFIG_ID',
      label: 'Embedded Signup configuration ID is missing.',
      hint: 'In Meta App Dashboard → Facebook Login for Business → Configurations, create a WhatsApp Embedded Signup configuration and set META_EMBEDDED_SIGNUP_CONFIG_ID.'
    });
  }

  const checklist = [
    {
      id: 'app',
      label: 'Meta App created',
      configured: Boolean(appId),
      how: appId ? 'Configured via META_APP_ID' : 'Set META_APP_ID'
    },
    {
      id: 'whatsapp-product',
      label: 'WhatsApp product configured on the app',
      configured: appId ? true : null,
      how: 'Meta App Dashboard → Add Product → WhatsApp → API Setup'
    },
    {
      id: 'flfb',
      label: 'Facebook Login for Business configured (Client OAuth settings: Web OAuth, Embedded Browser OAuth, Strict Mode, JavaScript SDK, Enforce HTTPS)',
      configured: null,
      how: 'Meta App Dashboard → Facebook Login for Business → Settings'
    },
    {
      id: 'config',
      label: 'Embedded Signup configuration created',
      configured: Boolean(configId),
      how: configId
        ? 'Configured via META_EMBEDDED_SIGNUP_CONFIG_ID'
        : 'Facebook Login for Business → Configurations → WhatsApp Embedded Signup'
    },
    {
      id: 'permissions',
      label: 'Permissions requested: whatsapp_business_management, whatsapp_business_messaging, business_management',
      configured: null,
      how: 'Meta App Dashboard → App Review → Permissions'
    },
    {
      id: 'advanced-access',
      label: 'Advanced Access status checked (required to onboard businesses other than your own)',
      configured: null,
      how: 'Meta App Dashboard → App Review → Permissions'
    },
    {
      id: 'app-review',
      label: 'App Review status checked (Live mode required for customer onboarding)',
      configured: null,
      how: 'Meta App Dashboard → App Review'
    },
    {
      id: 'business-verification',
      label: 'Business verification status checked',
      configured: null,
      how: 'Meta Business Manager → Security Center'
    },
    {
      id: 'domains',
      label: 'Allowed domains configured for this website',
      configured: null,
      how: 'Facebook Login for Business → Settings → Allowed domains + Valid OAuth redirect URIs'
    },
    {
      id: 'webhook',
      label: 'Webhook configured (messages, account_update) with verify token',
      configured: Boolean(webhookVerifyToken && webhookAppSecret),
      how:
        webhookVerifyToken && webhookAppSecret
          ? 'Configured via WHATSAPP_VERIFY_TOKEN / WHATSAPP_APP_SECRET'
          : 'Set WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET, then add the callback URL in Meta App Dashboard → WhatsApp → Configuration'
    },
    {
      id: 'production-mode',
      label: 'Production app mode requirements checked (App Review + Advanced Access)',
      configured: null,
      how: 'Meta App Dashboard → App Review → App Mode'
    }
  ];

  return {
    available: missing.length === 0,
    appId,
    graphVersion: GRAPH_API_VERSION,
    configId,
    coexistenceEnabled,
    missing,
    checklist,
    devModeNote:
      'In Development mode, only Meta app admins, developers and testers can complete Embedded Signup. Customers can only onboard once the app is in Live mode with Advanced Access granted for WhatsApp permissions.',
    webhookUrlHint: 'Your existing PulseFlow webhook is reused for every newly connected WABA.'
  };
}

// ---------------------------------------------------------------------------
// Connection storage helpers
// ---------------------------------------------------------------------------
export function toSafeConnectionView(conn) {
  if (!conn) return null;
  const c = typeof conn.toObject === 'function' ? conn.toObject() : { ...conn };
  return {
    id: c.id,
    userId: c.userId,
    connectionMethod: c.connectionMethod || 'EMBEDDED_SIGNUP',
    connectionStatus: c.connectionStatus || CONNECTION_STATUS.NOT_CONNECTED,
    webhookStatus: c.webhookStatus || 'PENDING',
    messagingStatus: c.messagingStatus || 'PENDING',
    coexistenceStatus: c.coexistenceStatus || COEXISTENCE_STATUS.NONE,
    coexistenceNote: c.coexistenceNote || '',
    aiEnabled: c.aiEnabled !== false,
    businessName: c.businessName || '',
    wabaName: c.wabaName || '',
    wabaIdMasked: maskId(c.wabaId),
    metaBusinessPortfolioIdMasked: maskId(c.metaBusinessPortfolioId || c.businessId),
    phoneNumberIdMasked: maskId(c.phoneNumberId),
    displayPhoneNumberMasked: maskPhone(c.displayPhoneNumber),
    verifiedName: c.verifiedName || '',
    qualityRating: c.qualityRating || '',
    sourceFlowEvent: c.sourceFlowEvent || '',
    lastError: sanitizeMessage(c.lastError),
    connectedAt: c.connectedAt || 0,
    updatedAt: c.updatedAt || 0
  };
}

export async function getActiveWhatsAppConnection(userId) {
  try {
    await connectDB();
    const filter = { connectionStatus: CONNECTION_STATUS.CONNECTED };
    if (userId) filter.userId = userId;
    const list = await WhatsAppConnection.find(filter).sort({ updatedAt: -1 });
    return Array.isArray(list) && list.length > 0 ? list[0] : null;
  } catch (err) {
    console.warn('[whatsapp-service] connection lookup failed:', err.message);
    return null;
  }
}

export async function getConnectionByPhoneNumberId(phoneNumberId) {
  if (!phoneNumberId) return null;
  try {
    await connectDB();
    const conn = await WhatsAppConnection.findOne({
      phoneNumberId: String(phoneNumberId),
      connectionStatus: CONNECTION_STATUS.CONNECTED
    });
    return conn || null;
  } catch (err) {
    console.warn('[whatsapp-service] connection lookup by phone id failed:', err.message);
    return null;
  }
}

export async function getUserConnections(userId) {
  try {
    await connectDB();
    const list = await WhatsAppConnection.find({ userId }).sort({ updatedAt: -1 });
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Credential resolution for outbound messaging
// Priority: explicit connection → stored connected account → env (manual config)
// ---------------------------------------------------------------------------
export function resolveConnectionCredentials(connection) {
  if (!connection) return null;
  const token = decryptSecret(connection.encryptedAccessToken);
  if (!token || !connection.phoneNumberId) return null;
  return {
    source: 'CONNECTION',
    token,
    phoneNumberId: connection.phoneNumberId,
    wabaId: connection.wabaId || '',
    connectionId: connection.id || ''
  };
}

export function resolveEnvCredentials() {
  const rawToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const token = rawToken.trim().replace(/['"]/g, '');
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token;

  const phoneId = (
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_PHONE_NUMBER_ID !== '109283746512345'
      ? process.env.WHATSAPP_PHONE_NUMBER_ID
      : '1384094818114996'
  )
    .trim()
    .replace(/['"]/g, '');

  const wabaId = (
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID &&
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID !== '987654321098765'
      ? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
      : '1409996531275243'
  )
    .trim()
    .replace(/['"]/g, '');

  if (!cleanToken || cleanToken.includes('replace_with_meta_permanent_access_token')) {
    return null;
  }
  return { source: 'ENV_MANUAL', token: cleanToken, phoneNumberId: phoneId, wabaId, connectionId: '' };
}

export async function resolveSendCredentials(explicitConnection) {
  if (explicitConnection) {
    return (
      resolveConnectionCredentials(explicitConnection) || resolveEnvCredentials()
    );
  }
  const stored = await getActiveWhatsAppConnection();
  if (stored) {
    const creds = resolveConnectionCredentials(stored);
    if (creds) return creds;
  }
  return resolveEnvCredentials();
}

// ---------------------------------------------------------------------------
// Outbound WhatsApp message via Meta Cloud API
// sendWhatsAppMessage(connection, recipient, text) — provider abstraction used
// by AI replies, agent replies and diagnostics alike.
// ---------------------------------------------------------------------------
export async function sendWhatsAppMessage(connection, toPhone, textBody) {
  const creds = await resolveSendCredentials(connection);
  const cleanPhone = String(toPhone || '').replace(/[^0-9]/g, '');
  const version = GRAPH_API_VERSION;

  const logBase = {
    to: cleanPhone || 'empty',
    credentialSource: creds?.source || 'none',
    phoneNumberId: creds?.phoneNumberId || 'missing',
    apiVersion: version,
    textLength: String(textBody || '').length
  };

  if (!creds || !cleanPhone) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({ ...logBase, reason: 'missing-whatsapp-config' })
    );
    return { sent: false, reason: 'missing-whatsapp-config' };
  }

  if (cleanPhone.length < 8) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({ ...logBase, reason: 'invalid-phone' })
    );
    return { sent: false, reason: 'invalid-phone' };
  }

  const t0 = Date.now();
  try {
    const url = `https://graph.facebook.com/${version}/${creds.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: textBody }
      })
    });

    const data = await response.json();
    const durationMs = Date.now() - t0;

    if (!response.ok) {
      const errCode = data?.error?.code;
      const errSubcode = data?.error?.error_subcode;
      const errType = data?.error?.type;
      const errMsg = sanitizeMessage(data?.error?.message || `HTTP ${response.status}`);
      const fbtraceId = data?.error?.fbtrace_id;

      let diagnosticHint = '';
      if (errCode === 131005) {
        diagnosticHint =
          `Error 131005 (Access denied): The access token lacks permission for WhatsApp Phone Number ID (${creds.phoneNumberId}). In Meta Business Manager, ensure the token owner has "Full Control" asset permission on the WABA (${creds.wabaId || 'unknown'}) and the token has "whatsapp_business_messaging" scope.`;
      } else if (errCode === 190) {
        diagnosticHint =
          'Error 190 (Invalid/Expired Access Token): The stored token is expired, revoked, or malformed. Reconnect WhatsApp from Settings → WhatsApp to issue a fresh token.';
      } else if (errCode === 131030) {
        diagnosticHint =
          'Error 131030 (Recipient not in allowlist): When using a Meta sandbox test number, recipient numbers must be added to the allowed phone numbers list in WhatsApp API Setup.';
      }

      console.warn(
        '[whatsapp-api] outgoing WhatsApp send failed',
        JSON.stringify({
          ...logBase,
          statusCode: response.status,
          errorCode: errCode,
          errorSubcode: errSubcode,
          errorType: errType,
          errorMessage: errMsg,
          fbtraceId,
          diagnosticHint: diagnosticHint || undefined,
          durationMs
        })
      );
      return {
        sent: false,
        error: errMsg,
        statusCode: response.status,
        errorCode: errCode,
        errorSubcode: errSubcode,
        errorType: errType,
        diagnosticHint: diagnosticHint || undefined
      };
    }

    const wamid = data?.messages?.[0]?.id || `wamid.out.${Date.now()}`;
    console.log(
      '[whatsapp-api] outgoing WhatsApp send completed',
      JSON.stringify({ ...logBase, whatsappMessageId: wamid, statusCode: response.status, durationMs })
    );
    return { sent: true, whatsappMessageId: wamid, statusCode: response.status };
  } catch (err) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({ ...logBase, error: sanitizeMessage(err.message), durationMs: Date.now() - t0 })
    );
    return { sent: false, error: sanitizeMessage(err.message) };
  }
}

// ---------------------------------------------------------------------------
// Meta Embedded Signup onboarding
// POST code → business (BISU) token → WABA + phone discovery → webhook
// subscription → encrypted persistence → safe metadata back to the UI.
// ---------------------------------------------------------------------------
export async function completeEmbeddedSignup({ userId, code, eventData, coexistenceRequested }) {
  const cfg = getMetaSignupConfig();
  if (!cfg.available) {
    throw new WhatsAppOnboardingError(
      'META_NOT_CONFIGURED',
      'Embedded Signup is not available yet. Complete the Meta App Review / permission configuration before enabling customer onboarding.',
      cfg.missing.map((m) => m.key).join(',')
    );
  }

  const cleanCode = String(code || '').trim();
  if (!cleanCode || cleanCode.length > 512) {
    throw new WhatsAppOnboardingError(
      'MISSING_AUTH_CODE',
      'Meta did not return an authorization code. If you cancelled or denied the Meta login, your existing WhatsApp connection was not changed.'
    );
  }

  const eventDataObj = eventData && typeof eventData === 'object' ? eventData : {};
  const eventDataPayload = eventDataObj.data && typeof eventDataObj.data === 'object'
    ? eventDataObj.data
    : {};
  const flowEvent = String(eventDataObj.event || '').trim();

  await connectDB();

  // STEP 1 — Exchange the short-lived authorization code for the business token.
  // Server-to-server only; the browser never receives this token.
  const exchange = await graphFetch('/oauth/access_token', {
    query: {
      client_id: cfg.appId,
      client_secret: process.env.META_APP_SECRET,
      code: cleanCode
    }
  });

  if (!exchange.ok || !exchange.data?.access_token) {
    throw graphErrorToOnboardingError('token-exchange', exchange);
  }

  const businessToken = exchange.data.access_token;
  const tokenExpiresIn = Number(exchange.data.expires_in || 0);

  // STEP 2 — Verify Meta actually issued this token to our app (defense in depth).
  try {
    const debug = await graphFetch('/debug_token', {
      query: {
        input_token: businessToken,
        access_token: `${cfg.appId}|${process.env.META_APP_SECRET}`
      }
    });
    const dbg = debug.data?.data;
    if (debug.ok && dbg && dbg.is_valid === false) {
      throw new WhatsAppOnboardingError(
        'TOKEN_EXCHANGE_FAILED',
        'Meta returned an invalid authorization token. Please try connecting again.'
      );
    }
    if (debug.ok && dbg && dbg.app_id && String(dbg.app_id) !== String(cfg.appId)) {
      throw new WhatsAppOnboardingError(
        'TOKEN_EXCHANGE_FAILED',
        'The Meta authorization was issued to a different app. Verify META_APP_ID matches the app used for Embedded Signup.'
      );
    }
  } catch (err) {
    if (err instanceof WhatsAppOnboardingError) throw err;
    // debug_token is a verification nicety — the WABA access check below is authoritative.
    console.warn('[whatsapp-onboarding] debug_token verification skipped:', sanitizeMessage(err.message));
  }

  // STEP 3 — Determine the WhatsApp Business Account from Meta's flow response.
  const wabaIds = Array.isArray(eventDataPayload.waba_ids)
    ? eventDataPayload.waba_ids.map(String).filter(Boolean)
    : [];
  const wabaId = String(
    eventDataPayload.waba_id || (wabaIds.length === 1 ? wabaIds[0] : '') || ''
  ).trim();

  if (!wabaId) {
    throw new WhatsAppOnboardingError(
      'WABA_UNAVAILABLE',
      'Meta did not return a WhatsApp Business Account for this authorization. Your existing WhatsApp connection was not changed.'
    );
  }

  // STEP 4 — Confirm the authorized business asset is readable with this token.
  let wabaInfo = null;
  const wabaRes = await graphFetch(`${wabaId}?fields=id,name,owner_business_info,currency`, {
    token: businessToken
  });
  if (!wabaRes.ok) {
    const fbErr = graphErrorToOnboardingError('waba-access', wabaRes);
    if (fbErr.code === 'PERMISSION_DENIED') throw fbErr;
    // Some business tokens restrict owner_business_info; retry minimal fields.
    const minimal = await graphFetch(`${wabaId}?fields=id,name`, { token: businessToken });
    if (!minimal.ok) throw graphErrorToOnboardingError('waba-access', minimal);
    wabaInfo = minimal.data || null;
  } else {
    wabaInfo = wabaRes.data || null;
  }

  const ownerInfo = wabaInfo?.owner_business_info || {};
  const businessId = String(
    eventDataPayload.business_id || ownerInfo.id || wabaInfo?.id || ''
  ).trim();

  // STEP 5 — Discover the connected phone number.
  const eventPhoneNumberId = String(eventDataPayload.phone_number_id || '').trim();
  let phoneInfo = null;
  let phoneList = [];

  const phoneListRes = await graphFetch(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status,code_verification_status`,
    { token: businessToken }
  );
  if (phoneListRes.ok && Array.isArray(phoneListRes.data?.data)) {
    phoneList = phoneListRes.data.data;
  } else {
    const fallback = await graphFetch(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, {
      token: businessToken
    });
    if (fallback.ok && Array.isArray(fallback.data?.data)) phoneList = fallback.data.data;
  }

  if (eventPhoneNumberId) {
    phoneInfo = phoneList.find((p) => String(p.id) === eventPhoneNumberId) || null;
    if (!phoneInfo) {
      const direct = await graphFetch(
        `${eventPhoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,status,code_verification_status`,
        { token: businessToken }
      );
      if (direct.ok) phoneInfo = direct.data;
    }
  }
  if (!phoneInfo && phoneList.length >= 1) {
    phoneInfo = phoneList[0];
  }

  if (!phoneInfo?.id) {
    throw new WhatsAppOnboardingError(
      'PHONE_NUMBER_UNAVAILABLE',
      'Meta did not return a WhatsApp Business phone number for this connection. Your existing WhatsApp connection was not changed.'
    );
  }

  // STEP 6 — Subscribe this WABA to the PulseFlow app's existing webhook.
  let webhookStatus = 'CONNECTED';
  let webhookWarning = '';
  const subRes = await graphFetch(`${wabaId}/subscribed_apps`, {
    method: 'POST',
    token: businessToken
  });
  if (!subRes.ok || subRes.data?.success === false) {
    webhookStatus = 'ERROR';
    const fbErr = graphErrorToOnboardingError('webhook-subscribe', subRes);
    webhookWarning = fbErr.userMessage;
    console.warn(
      '[whatsapp-onboarding] webhook subscription failed',
      JSON.stringify({ wabaId, detail: fbErr.detail })
    );
  }

  // STEP 7 — Determine messaging readiness from Meta's real phone status.
  const phoneStatus = String(phoneInfo.status || '').toUpperCase();
  const verificationStatus = String(phoneInfo.code_verification_status || '').toUpperCase();
  let messagingStatus = 'ACTIVE';
  let messagingWarning = '';
  if (phoneStatus === 'REJECTED' || verificationStatus === 'REJECTED') {
    messagingStatus = 'ERROR';
    messagingWarning =
      'Meta reported this phone number as rejected. Review the number status in Meta Business Manager → WhatsApp → Phone Numbers.';
  } else if (phoneStatus === 'PENDING' || verificationStatus === 'NOT_VERIFIED') {
    messagingStatus = 'PENDING';
    messagingWarning =
      'This phone number is awaiting verification with Meta. Complete verification (SMS/voice code) before messages can be sent.';
  }

  // STEP 8 — Coexistence (WhatsApp Business App + Cloud API onboarding).
  let coexistenceStatus = COEXISTENCE_STATUS.NONE;
  let coexistenceNote = '';
  if (flowEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
    coexistenceStatus = COEXISTENCE_STATUS.CONNECTED;
    coexistenceNote =
      'Meta confirmed your existing WhatsApp Business App number is connected alongside the Cloud API. Your WhatsApp Business mobile app remains active and usable.';
  } else if (coexistenceRequested) {
    coexistenceStatus = COEXISTENCE_STATUS.NOT_ELIGIBLE;
    coexistenceNote =
      'Coexistence is not currently available/eligible for this Meta account or number. Meta completed a standard WhatsApp Cloud API connection instead. No changes were made to your existing WhatsApp Business App.';
  } else {
    coexistenceStatus = COEXISTENCE_STATUS.NONE;
    coexistenceNote =
      'Standard WhatsApp Cloud API connection. WhatsApp Business App coexistence was not requested for this connection.';
  }

  // STEP 9 — Persist (encrypt the token at rest; never returned to the client).
  const now = Date.now();
  const previousForUser = await WhatsAppConnection.find({ userId }).sort({ updatedAt: -1 });
  const existing = Array.isArray(previousForUser) && previousForUser.length > 0
    ? previousForUser[0]
    : null;

  if (existing && existing.connectionStatus === CONNECTION_STATUS.CONNECTED) {
    existing.connectionStatus = CONNECTION_STATUS.DISCONNECTED;
    existing.webhookStatus = 'DISCONNECTED';
    existing.encryptedAccessToken = '';
    existing.updatedAt = now;
    existing.lastError = '';
    await existing.save().catch(() => {});
  }

  const connectionFields = {
    userId,
    businessId,
    metaBusinessPortfolioId: String(eventDataPayload.business_id || businessId || ''),
    businessName: ownerInfo.name || '',
    wabaId,
    wabaName: wabaInfo?.name || '',
    phoneNumberId: String(phoneInfo.id),
    displayPhoneNumber: phoneInfo.display_phone_number || '',
    verifiedName: phoneInfo.verified_name || '',
    connectionMethod: 'EMBEDDED_SIGNUP',
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    webhookStatus,
    messagingStatus,
    coexistenceStatus,
    coexistenceNote,
    aiEnabled: true,
    qualityRating: phoneInfo.quality_rating || '',
    sourceFlowEvent: flowEvent,
    encryptedAccessToken: encryptSecret(businessToken),
    tokenType: exchange.data.token_type || 'bearer',
    tokenExpiresAt: tokenExpiresIn ? now + tokenExpiresIn * 1000 : 0,
    lastError: webhookWarning || messagingWarning || '',
    updatedAt: now
  };

  const sameAccount = await WhatsAppConnection.findOne({
    userId,
    phoneNumberId: String(phoneInfo.id)
  });

  let connection;
  if (sameAccount) {
    Object.assign(sameAccount, connectionFields);
    sameAccount.connectedAt = sameAccount.connectedAt || now;
    await sameAccount.save();
    connection = sameAccount;
  } else {
    connection = await WhatsAppConnection.create({
      id: `wac-${now}-${Math.random().toString(36).slice(2, 8)}`,
      connectedAt: now,
      ...connectionFields
    });
  }

  console.log(
    '[whatsapp-onboarding] connection stored',
    JSON.stringify({
      connectionId: connection?.id,
      wabaId,
      phoneNumberId: phoneInfo.id,
      webhookStatus,
      messagingStatus,
      coexistenceStatus,
      flowEvent
    })
  );

  const warnings = [];
  if (webhookWarning) warnings.push(webhookWarning);
  if (messagingWarning) warnings.push(messagingWarning);
  if (coexistenceStatus === COEXISTENCE_STATUS.NOT_ELIGIBLE) warnings.push(coexistenceNote);

  return { connection: toSafeConnectionView(connection), warnings };
}

// ---------------------------------------------------------------------------
// Safe disconnect — PulseFlow-side only. Never touches the user's Meta
// Business Portfolio, WABA, phone registration or WhatsApp Business App.
// ---------------------------------------------------------------------------
export async function disconnectWhatsAppConnection(userId) {
  await connectDB();
  const list = await WhatsAppConnection.find({
    userId,
    connectionStatus: CONNECTION_STATUS.CONNECTED
  }).sort({ updatedAt: -1 });
  const conn = Array.isArray(list) && list.length > 0 ? list[0] : null;

  if (!conn) {
    throw new WhatsAppOnboardingError(
      'NOT_CONNECTED',
      'There is no connected WhatsApp account to disconnect.'
    );
  }

  const now = Date.now();
  conn.connectionStatus = CONNECTION_STATUS.DISCONNECTED;
  conn.webhookStatus = 'DISCONNECTED';
  conn.encryptedAccessToken = '';
  conn.tokenExpiresAt = 0;
  conn.updatedAt = now;
  conn.lastError = '';
  await conn.save();

  console.log(
    '[whatsapp-onboarding] disconnected (PulseFlow-side only)',
    JSON.stringify({ connectionId: conn.id, wabaId: conn.wabaId })
  );

  return toSafeConnectionView(conn);
}

export async function setConnectionAiEnabled(userId, enabled) {
  await connectDB();
  const list = await WhatsAppConnection.find({
    userId,
    connectionStatus: CONNECTION_STATUS.CONNECTED
  }).sort({ updatedAt: -1 });
  const conn = Array.isArray(list) && list.length > 0 ? list[0] : null;
  if (!conn) {
    throw new WhatsAppOnboardingError('NOT_CONNECTED', 'No connected WhatsApp account was found.');
  }
  conn.aiEnabled = Boolean(enabled);
  conn.updatedAt = Date.now();
  await conn.save();
  return toSafeConnectionView(conn);
}
