import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import mongoose, {
  connectDB,
  TeamMember,
  Contact,
  Lead,
  Conversation,
  Message,
  FollowUp,
  KnowledgeBase,
  KnowledgeGap,
  Setting,
  Notification,
  WhatsAppAccount,
  SystemConfig,
  INITIAL_SYSTEM_CONFIG,
  hashPassword,
  verifyPassword,
  encryptSecret,
  decryptSecret,
  isEncryptedSecret
} from './db.js';
import {
  INITIAL_AI_SETTINGS,
  INITIAL_WHATSAPP_SETTINGS,
  INITIAL_COMPANY_SETTINGS
} from './defaultData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const DIST_DIR = path.join(__dirname, 'dist');
const WEBHOOK_PATHS = new Set(['/webhook', '/api/webhooks/whatsapp', '/health']);

const app = express();
app.disable('x-powered-by');

// Capture raw bytes for X-Hub-Signature-256 verification
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  })
);
app.use(express.urlencoded({ extended: true }));

// Constant-time string comparison
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(req, resolvedAppSecret = '') {
  const secret = String(resolvedAppSecret || '').trim();
  if (!secret || secret === 'replace_with_meta_app_secret_for_hmac_sha256') {
    return { ok: false, reason: 'app-secret-not-configured' };
  }

  const header = req.get('x-hub-signature-256');
  if (!header) return { ok: false, reason: 'signature-header-missing' };
  if (!header.startsWith('sha256=')) return { ok: false, reason: 'signature-malformed' };
  if (!req.rawBody || req.rawBody.length === 0) return { ok: false, reason: 'body-missing' };

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  return safeCompare(header, expected)
    ? { ok: true, reason: 'valid' }
    : { ok: false, reason: 'signature-mismatch' };
}

// Masking helpers so sensitive identifiers are masked in UI and secrets/tokens are NEVER exposed
function maskPhoneNumber(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return `+${digits}`;
  const cc = digits.slice(0, digits.length > 10 ? digits.length - 10 : 2);
  const last4 = digits.slice(-4);
  return `+${cc} ••••• •${last4}`;
}

function maskIdentifier(id) {
  const raw = String(id || '').trim();
  if (!raw) return '';
  if (raw.length <= 5) return raw;
  return `${'•'.repeat(Math.min(10, raw.length - 5))}${raw.slice(-5)}`;
}

// Helper to strip Mongoose _id / __v and ALL sensitive password hash / token / encrypted secret fields
const cleanDoc = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const {
    _id,
    __v,
    passwordHash,
    passwordSalt,
    password,
    accessToken,
    metaAppSecretEncrypted,
    whatsappVerifyTokenEncrypted,
    geminiApiKeyEncrypted,
    openaiApiKeyEncrypted,
    metaAppSecret,
    whatsappVerifyToken,
    verifyToken,
    geminiApiKey,
    openaiApiKey,
    n8nEnabled,
    n8nWebhookUrl,
    n8nForwardingEnabled,
    ...rest
  } = obj;
  return rest;
};

const cleanList = (docs) => docs.map(cleanDoc);

const JWT_SECRET = process.env.JWT_SECRET || 'pulseflow-whatsapp-crm-jwt-secret-2026';

function signJwtToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwtToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (!safeCompare(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function extractAuthUserFromReq(req) {
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifyJwtToken(token);
  }
  return null;
}

const VALID_ROLES = ['ADMIN', 'AGENT'];

async function resolveAuthenticatedUser(req) {
  await connectDB();
  const decoded = extractAuthUserFromReq(req);
  if (!decoded || !decoded.id) return null;
  const member = await TeamMember.findOne({ id: decoded.id });
  if (!member || member.isActive === false) return null;
  const actualRole = member.role === 'ADMIN' ? 'ADMIN' : 'AGENT';
  const cleaned = cleanDoc(member);
  return { ...cleaned, role: actualRole };
}

async function requireAuth(req, res, next) {
  try {
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.authUser = user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access Denied: Only ADMIN accounts are authorized to perform this operation.'
      });
    }
    req.authUser = user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================================
// RUNTIME SYSTEM & INTEGRATION CONFIGURATION RESOLVER (MONGODB + AES-256-GCM)
// Reads encrypted SystemConfig from MongoDB first, decrypting secrets strictly
// in server memory. Never exposes raw secrets to any client response.
// ============================================================================
async function getRuntimeSystemConfig(req = null) {
  try {
    await connectDB();
  } catch {
    // ignore db connection notice
  }

  let sysDoc = null;
  try {
    sysDoc = await SystemConfig.findOne({ id: 'primary' });
    if (!sysDoc) {
      sysDoc = await SystemConfig.create({
        ...INITIAL_SYSTEM_CONFIG,
        updatedAt: new Date().toISOString()
      });
    }
  } catch {
    sysDoc = { ...INITIAL_SYSTEM_CONFIG };
  }

  let waAccount = null;
  try {
    waAccount = await WhatsAppAccount.findOne({ id: 'primary' });
  } catch {
    // ignore
  }

  // Decrypt secrets strictly in server memory
  const dbMetaAppSecret = decryptSecret(sysDoc?.metaAppSecretEncrypted || '');
  const dbVerifyToken = decryptSecret(sysDoc?.whatsappVerifyTokenEncrypted || '');
  const dbGeminiApiKey = decryptSecret(sysDoc?.geminiApiKeyEncrypted || '');
  const dbOpenaiApiKey = decryptSecret(sysDoc?.openaiApiKeyEncrypted || '');

  // Optional ENV fallbacks if not yet saved in MongoDB
  const envMetaSecretRaw = (
    process.env.META_APP_SECRET ||
    process.env.WHATSAPP_APP_SECRET ||
    ''
  ).trim();
  const envMetaSecret =
    envMetaSecretRaw && envMetaSecretRaw !== 'replace_with_meta_app_secret_for_hmac_sha256'
      ? envMetaSecretRaw
      : '';
  const envVerifyToken = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  const envGeminiKey =
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ? String(process.env.GEMINI_API_KEY).trim()
      : '';
  const envOpenaiRaw = (process.env.OPENAI_API_KEY || '').trim();
  const envOpenaiKey =
    envOpenaiRaw && !envOpenaiRaw.startsWith('github_pat_') && !envOpenaiRaw.startsWith('ghp_')
      ? envOpenaiRaw
      : '';

  const resolvedMetaAppSecret = dbMetaAppSecret || envMetaSecret;
  const resolvedVerifyToken = dbVerifyToken || envVerifyToken;
  const resolvedGeminiApiKey = dbGeminiApiKey || envGeminiKey;
  const resolvedOpenaiApiKey = dbOpenaiApiKey || envOpenaiKey;

  const metaAppId = String(
    sysDoc?.metaAppId ||
      waAccount?.metaAppId ||
      process.env.META_APP_ID ||
      process.env.VITE_META_APP_ID ||
      '1420003542794708'
  ).trim();

  const embeddedSignupConfigId = String(
    sysDoc?.embeddedSignupConfigId ||
      waAccount?.embeddedSignupConfigId ||
      process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ||
      process.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID ||
      ''
  ).trim();

  let whatsappApiVersion = String(
    sysDoc?.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0'
  )
    .trim()
    .replace(/['"]/g, '')
    .replace(/^\/+|\/+$/g, '');
  if (!whatsappApiVersion.startsWith('v')) whatsappApiVersion = `v${whatsappApiVersion}`;

  const fallbackOrigin = req
    ? `${req.protocol}://${req.get('host')}`
    : 'https://pulseflow-whatsapp-ai-crm-web.onrender.com';

  const publicAppUrl = String(
    sysDoc?.publicAppUrl ||
      (process.env.BACKEND_URL || '').trim() ||
      (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL : '') ||
      fallbackOrigin
  )
    .trim()
    .replace(/\/+$/, '');

  const frontendUrl = String(
    sysDoc?.frontendUrl || (process.env.FRONTEND_URL || '').trim() || publicAppUrl
  )
    .trim()
    .replace(/\/+$/, '');

  const webhookUrl = `${publicAppUrl}/webhook`;

  const aiProvider =
    String(sysDoc?.aiProvider || process.env.AI_PROVIDER || 'GEMINI').toUpperCase() === 'OPENAI'
      ? 'OPENAI'
      : 'GEMINI';
  const geminiModel = String(
    sysDoc?.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  ).trim();
  const openaiModel = String(
    sysDoc?.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  ).trim();

  return {
    sysDoc,
    publicAppUrl,
    frontendUrl,
    webhookUrl,
    metaAppId,
    embeddedSignupConfigId,
    whatsappApiVersion,
    // Decrypted secrets for server-side internal execution ONLY
    metaAppSecret: resolvedMetaAppSecret,
    whatsappVerifyToken: resolvedVerifyToken,
    geminiApiKey: resolvedGeminiApiKey,
    openaiApiKey: resolvedOpenaiApiKey,
    // Secret presence flags
    metaAppSecretConfigured: Boolean(resolvedMetaAppSecret),
    metaAppSecretStoredInDb: Boolean(dbMetaAppSecret),
    whatsappVerifyTokenConfigured: Boolean(resolvedVerifyToken),
    whatsappVerifyTokenStoredInDb: Boolean(dbVerifyToken),
    geminiApiKeyConfigured: Boolean(resolvedGeminiApiKey),
    geminiApiKeyStoredInDb: Boolean(dbGeminiApiKey),
    openaiApiKeyConfigured: Boolean(resolvedOpenaiApiKey),
    openaiApiKeyStoredInDb: Boolean(dbOpenaiApiKey),
    aiProvider,
    geminiModel,
    openaiModel,
    updatedBy: sysDoc?.updatedBy || '',
    updatedAt: sysDoc?.updatedAt || ''
  };
}

// Build a 100% secret-free configuration object safe for React/browser responses
function buildSanitizedSystemConfig(runtimeCfg) {
  const sdkReadyToLaunch = Boolean(runtimeCfg.metaAppId && runtimeCfg.embeddedSignupConfigId);
  const metaConfigurationPresent = Boolean(
    runtimeCfg.metaAppId &&
      runtimeCfg.embeddedSignupConfigId &&
      runtimeCfg.metaAppSecretConfigured
  );
  const activeAiKeyConfigured =
    runtimeCfg.aiProvider === 'OPENAI'
      ? runtimeCfg.openaiApiKeyConfigured
      : runtimeCfg.geminiApiKeyConfigured;
  const anyAiKeyConfigured = Boolean(
    runtimeCfg.geminiApiKeyConfigured || runtimeCfg.openaiApiKeyConfigured
  );

  const missingConfigVars = [];
  if (!runtimeCfg.metaAppId) missingConfigVars.push('META_APP_ID');
  if (!runtimeCfg.embeddedSignupConfigId)
    missingConfigVars.push('META_EMBEDDED_SIGNUP_CONFIG_ID');
  if (!runtimeCfg.metaAppSecretConfigured) missingConfigVars.push('META_APP_SECRET');

  return {
    publicAppUrl: runtimeCfg.publicAppUrl,
    frontendUrl: runtimeCfg.frontendUrl,
    webhookUrl: runtimeCfg.webhookUrl,
    metaAppId: runtimeCfg.metaAppId,
    embeddedSignupConfigId: runtimeCfg.embeddedSignupConfigId,
    whatsappApiVersion: runtimeCfg.whatsappApiVersion,
    metaAppSecretConfigured: Boolean(runtimeCfg.metaAppSecretConfigured),
    metaAppSecretStoredInDb: Boolean(runtimeCfg.metaAppSecretStoredInDb),
    metaAppSecretMasked: runtimeCfg.metaAppSecretConfigured ? '••••••••••••' : '',
    whatsappVerifyTokenConfigured: Boolean(runtimeCfg.whatsappVerifyTokenConfigured),
    whatsappVerifyTokenStoredInDb: Boolean(runtimeCfg.whatsappVerifyTokenStoredInDb),
    whatsappVerifyTokenMasked: runtimeCfg.whatsappVerifyTokenConfigured ? '••••••••••••' : '',
    metaConfigurationPresent,
    sdkReadyToLaunch,
    missingConfigVars,
    configurationStatus: metaConfigurationPresent
      ? 'READY'
      : 'CODE COMPLETE — META CONFIGURATION REQUIRED',
    aiProvider: runtimeCfg.aiProvider,
    aiProviderConfigured: Boolean(activeAiKeyConfigured || anyAiKeyConfigured),
    activeAiProviderConfigured: Boolean(activeAiKeyConfigured),
    geminiModel: runtimeCfg.geminiModel,
    geminiApiKeyConfigured: Boolean(runtimeCfg.geminiApiKeyConfigured),
    geminiApiKeyStoredInDb: Boolean(runtimeCfg.geminiApiKeyStoredInDb),
    geminiApiKeyMasked: runtimeCfg.geminiApiKeyConfigured ? '••••••••••••' : '',
    openaiModel: runtimeCfg.openaiModel,
    openaiApiKeyConfigured: Boolean(runtimeCfg.openaiApiKeyConfigured),
    openaiApiKeyStoredInDb: Boolean(runtimeCfg.openaiApiKeyStoredInDb),
    openaiApiKeyMasked: runtimeCfg.openaiApiKeyConfigured ? '••••••••••••' : '',
    encryptionAlgorithm: 'AES-256-GCM',
    infrastructureEnvStatus: {
      mongodbConfigured: Boolean(process.env.MONGODB_URI),
      jwtSecretConfigured: Boolean(process.env.JWT_SECRET),
      encryptionKeyConfigured: Boolean(
        process.env.SETTINGS_ENCRYPTION_KEY ||
          process.env.ENCRYPTION_KEY ||
          process.env.JWT_SECRET
      )
    },
    updatedBy: runtimeCfg.updatedBy || '',
    updatedAt: runtimeCfg.updatedAt || ''
  };
}

// Resolve active WhatsApp Cloud API credentials strictly from verified connected WhatsAppAccount in MongoDB
// Decrypts accessToken in server memory only. NEVER uses hardcoded Phone Number ID, WABA ID, Business Name, or Test Number.
async function getActiveWhatsAppCredentials() {
  const sysCfg = await getRuntimeSystemConfig();

  let waAccount = null;
  try {
    waAccount = await WhatsAppAccount.findOne({ id: 'primary' });
  } catch {
    // ignore
  }

  const version = sysCfg.whatsappApiVersion || 'v21.0';
  const connectionStatus = waAccount?.connectionStatus || waAccount?.status || 'NOT_CONNECTED';
  const dbToken = decryptSecret(waAccount?.accessToken || '');
  const dbPhoneId = String(waAccount?.phoneNumberId || '').trim();
  const dbWabaId = String(waAccount?.wabaId || '').trim();
  const messagingActive = Boolean(waAccount?.messagingActive === true);
  const webhookSubscribed = Boolean(waAccount?.webhookSubscribed === true);

  const canSend = Boolean(
    waAccount &&
      connectionStatus === 'CONNECTED' &&
      messagingActive === true &&
      webhookSubscribed === true &&
      dbToken &&
      dbPhoneId &&
      dbWabaId
  );

  return {
    token: canSend ? dbToken : '',
    phoneNumberId: canSend ? dbPhoneId : '',
    wabaId: canSend ? dbWabaId : '',
    version,
    canSend,
    connectionStatus,
    messagingActive,
    webhookSubscribed,
    source: canSend ? 'VERIFIED_WHATSAPP_ACCOUNT' : 'NOT_CONNECTED',
    waAccount
  };
}

// Helper to send outgoing WhatsApp messages via Meta Cloud API
// Uses ONLY the verified connected WhatsAppAccount stored in MongoDB.
async function sendWhatsAppCloudMessage(toPhone, textBody) {
  const creds = await getActiveWhatsAppCredentials();
  const cleanToken = creds.token;
  const phoneId = creds.phoneNumberId;
  const wabaId = creds.wabaId;
  const version = creds.version;

  const cleanPhone = String(toPhone || '').replace(/[^0-9]/g, '');
  console.log(
    '[whatsapp-api] outgoing WhatsApp send check',
    JSON.stringify({
      to: cleanPhone || 'empty',
      connectionStatus: creds.connectionStatus,
      messagingActive: creds.messagingActive,
      webhookSubscribed: creds.webhookSubscribed,
      canSend: creds.canSend,
      phoneNumberId: phoneId ? maskIdentifier(phoneId) : 'none',
      apiVersion: version
    })
  );

  if (
    !creds.canSend ||
    creds.connectionStatus !== 'CONNECTED' ||
    creds.messagingActive !== true ||
    creds.webhookSubscribed !== true ||
    !cleanToken ||
    !phoneId ||
    !wabaId
  ) {
    const errMessage =
      'Cannot send WhatsApp message: No verified connected WhatsApp account found (requires connectionStatus=CONNECTED, messagingActive=true, and webhookSubscribed=true).';
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send blocked (unverified or disconnected account)',
      JSON.stringify({
        reason: 'whatsapp-not-connected',
        connectionStatus: creds.connectionStatus,
        messagingActive: creds.messagingActive,
        webhookSubscribed: creds.webhookSubscribed,
        hasToken: Boolean(cleanToken),
        hasPhoneId: Boolean(phoneId),
        hasWabaId: Boolean(wabaId)
      })
    );
    return {
      sent: false,
      reason: 'whatsapp-not-connected',
      error: errMessage
    };
  }

  if (!toPhone || cleanPhone.length < 8) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({ reason: 'invalid-phone', to: cleanPhone })
    );
    return {
      sent: false,
      reason: 'invalid-phone',
      error: 'Valid recipient phone number is required.'
    };
  }

  const t0 = Date.now();
  try {
    const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
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
      const errMsg = data?.error?.message;
      const fbtraceId = data?.error?.fbtrace_id;

      let diagnosticHint = '';
      if (errCode === 131005) {
        diagnosticHint = `Error 131005 (Access denied): The access token lacks permission for WhatsApp Phone Number ID (${maskIdentifier(
          phoneId
        )}). Ensure the System User has Full Control on WABA (${maskIdentifier(
          wabaId
        )}) with whatsapp_business_messaging scope.`;
      } else if (errCode === 190) {
        diagnosticHint =
          'Error 190 (Invalid/Expired Access Token): Reconnect WhatsApp via Meta Embedded Signup.';
      } else if (errCode === 131030) {
        diagnosticHint =
          'Error 131030 (Recipient not in allowlist): Add the recipient phone number to the Meta allowlist if using a test number.';
      }

      console.warn(
        '[whatsapp-api] outgoing WhatsApp send failed',
        JSON.stringify({
          to: cleanPhone,
          phoneNumberId: maskIdentifier(phoneId),
          apiVersion: version,
          statusCode: response.status,
          errorCode: errCode,
          errorSubcode: errSubcode,
          errorType: errType,
          errorMessage: errMsg || `HTTP ${response.status}`,
          fbtraceId,
          durationMs
        })
      );
      return {
        sent: false,
        error: errMsg || `HTTP ${response.status}`,
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
      JSON.stringify({
        to: cleanPhone,
        phoneNumberId: maskIdentifier(phoneId),
        apiVersion: version,
        whatsappMessageId: wamid,
        statusCode: response.status,
        durationMs
      })
    );
    return { sent: true, whatsappMessageId: wamid, statusCode: response.status };
  } catch (err) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({
        to: cleanPhone,
        phoneNumberId: maskIdentifier(phoneId),
        apiVersion: version,
        error: err.message,
        durationMs: Date.now() - t0
      })
    );
    return { sent: false, error: err.message };
  }
}

// Safe startup validation to check verified WhatsAppAccount connection without hardcoded IDs
async function validateWhatsAppCloudApiOnStartup() {
  const creds = await getActiveWhatsAppCredentials();
  if (!creds.canSend || !creds.token || !creds.phoneNumberId) {
    console.log(
      '[whatsapp-startup-check] No verified WhatsAppAccount connected yet. Use Settings -> WhatsApp Connection (Meta Embedded Signup) to connect.'
    );
    return;
  }

  try {
    const url = `https://graph.facebook.com/${creds.version}/${creds.phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.token}` }
    });
    const data = await res.json();
    if (res.ok) {
      console.log(
        '[whatsapp-startup-check] Verified connected WhatsAppAccount on startup:',
        JSON.stringify({
          phoneNumberId: maskIdentifier(data.id || creds.phoneNumberId),
          displayPhoneNumber: maskPhoneNumber(data.display_phone_number),
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating
        })
      );
    } else {
      console.warn(
        '[whatsapp-startup-check] Connected WhatsAppAccount token check returned error:',
        data?.error?.message || `HTTP ${res.status}`
      );
    }
  } catch (err) {
    console.warn('[whatsapp-startup-check] network error during validation:', err.message);
  }
}

// AI Service Layer (Supports OpenAI / GitHub Models & Google Gemini API)
async function generateAIQualificationAndReply({
  customerMessage,
  contact,
  lead,
  historyMessages = [],
  knowledgeBase = [],
  aiSettings = INITIAL_AI_SETTINGS
}) {
  const activeKb = knowledgeBase.filter((k) => k.isActive !== false);
  const kbText =
    activeKb.length > 0
      ? activeKb
          .map((k) => `[${k.category}] ${k.title}: ${k.content}`)
          .join('\n\n')
      : 'No custom Knowledge Base articles added yet. Politely ask the customer about their service requirements, budget, and timeline.';

  const historyText = historyMessages
    .slice(-8)
    .map((m) => `${m.senderType}: ${m.content}`)
    .join('\n');

  const systemInstruction = `${aiSettings.systemPrompt || INITIAL_AI_SETTINGS.systemPrompt}

COMPANY KNOWLEDGE BASE:
${kbText}

CUSTOMER CONTEXT:
Name: ${contact?.name || 'Customer'}
Phone: ${contact?.phone || ''}
Current Interested Service: ${lead?.interestedService || 'Unknown'}
Current Budget: ${lead?.budget || 'Not disclosed'}
Current Timeline: ${lead?.timeline || 'Not specified'}

Analyze the customer message and return a JSON object with:
- reply: Natural, helpful response in the customer's language (English, Manglish, or Malayalam).
- intent: One of "pricing_enquiry", "service_enquiry", "request_for_quotation", "purchase_intent", "human_request", "general_enquiry".
- service: Identified service name (e.g., "Web Development", "E-Commerce", "Mobile App", "Digital Marketing", "General Inquiry").
- leadType: One of "HOT", "WARM", "COLD", "UNQUALIFIED".
- leadScore: Integer from 0 to 100 based on budget readiness, urgency, and specificity.
- budget: Extracted budget string (or keep "${lead?.budget || 'Not disclosed'}").
- timeline: Extracted timeline string (or keep "${lead?.timeline || 'Not specified'}").
- requirements: Array of specific customer requirements extracted so far.
- summary: 1-2 sentence summary of what the customer wants and their qualification status.
- needsHuman: Boolean (true if customer asks for a human/manager, has a complaint/refund request, or confidence < ${aiSettings.humanHandoffThreshold || 0.7}).
- confidence: Float between 0.0 and 1.0.`;

  const userPrompt = `Recent Conversation History:\n${historyText}\n\nLatest Customer Message:\n"${customerMessage}"\n\nRespond strictly with valid JSON.`;

  const sysCfg = await getRuntimeSystemConfig();
  const oaKey = (sysCfg.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  const isGithubPat = oaKey.startsWith('github_pat_') || oaKey.startsWith('ghp_');
  const activeGeminiKey = sysCfg.geminiApiKey;
  const hasValidGeminiKey = Boolean(activeGeminiKey);

  const configuredProvider = String(
    sysCfg.aiProvider || aiSettings.provider || process.env.AI_PROVIDER || 'GEMINI'
  ).toUpperCase();

  // If OPENAI_API_KEY is a GitHub PAT rather than an sk- OpenAI key and Gemini is configured, route directly to Gemini
  const preferProvider =
    isGithubPat && hasValidGeminiKey ? 'GEMINI' : configuredProvider;

  // Helper to run OpenAI / GitHub Models
  const tryOpenAIProvider = async () => {
    if (!oaKey) return null;
    try {
      const endpoint = isGithubPat
        ? 'https://models.github.ai/inference/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      const baseModel =
        sysCfg.openaiModel ||
        (aiSettings.model && !aiSettings.model.startsWith('gemini')
          ? aiSettings.model
          : process.env.OPENAI_MODEL || 'gpt-4o-mini');
      const modelName =
        isGithubPat && !baseModel.includes('/') ? `openai/${baseModel}` : baseModel;

      console.log(
        '[ai-service] OpenAI request started',
        JSON.stringify({ model: modelName, isGithubModels: isGithubPat })
      );

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${oaKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          temperature: Number(aiSettings.temperature ?? 0.3),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (res.ok) {
        const rawText = await res.text();
        if (rawText && rawText.trim().startsWith('{')) {
          const data = JSON.parse(rawText);
          const raw = data?.choices?.[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(raw);
            console.log(`[ai-service] Response generated via OpenAI (${modelName})`);
            return {
              ...normalizeAIOutput(parsed, lead),
              providerUsed: 'OPENAI',
              modelUsed: modelName
            };
          }
        }
        console.warn('[ai-service] OpenAI/GitHub Models returned non-JSON body, falling back to Gemini');
      } else {
        console.warn('[ai-service] OpenAI/GitHub Models non-200 status, falling back to Gemini:', res.status);
      }
    } catch (err) {
      console.warn('[ai-service] OpenAI provider error, falling back to Gemini:', err.message);
    }
    return null;
  };

  // Helper to run Google Gemini API via @google/genai SDK with automatic model failover on 503
  const tryGeminiProvider = async () => {
    if (!hasValidGeminiKey) {
      console.warn('[ai-service] Gemini API key not configured, skipping Gemini provider');
      return null;
    }

    const ai = new GoogleGenAI({
      apiKey: activeGeminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const rawConfiguredModel =
      sysCfg.geminiModel ||
      (aiSettings.model && aiSettings.model.startsWith('gemini') ? aiSettings.model : null) ||
      process.env.GEMINI_MODEL ||
      'gemini-3.5-flash-lite';

    // Map models known to experience 30s+ 503 stalls (gemini-3.8-flash) behind fast available models
    const HIGH_DEMAND_MODELS = new Set(['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']);
    const primaryModel = HIGH_DEMAND_MODELS.has(rawConfiguredModel)
      ? 'gemini-3.5-flash-lite'
      : rawConfiguredModel;

    const candidateModels = Array.from(
      new Set([
        primaryModel,
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.6-flash'
      ])
    );

    for (let i = 0; i < candidateModels.length; i++) {
      const geminiModel = candidateModels[i];
      const reqStart = Date.now();
      console.log(
        '[ai-service] Gemini request started',
        JSON.stringify({
          model: geminiModel,
          configuredModel: rawConfiguredModel,
          attempt: i + 1
        })
      );

      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: geminiModel,
            contents: userPrompt,
            config: {
              systemInstruction,
              temperature: Number(aiSettings.temperature ?? 0.3),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  reply: { type: Type.STRING },
                  intent: { type: Type.STRING },
                  service: { type: Type.STRING },
                  leadType: { type: Type.STRING },
                  leadScore: { type: Type.INTEGER },
                  budget: { type: Type.STRING },
                  timeline: { type: Type.STRING },
                  requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                  summary: { type: Type.STRING },
                  needsHuman: { type: Type.BOOLEAN },
                  confidence: { type: Type.NUMBER }
                },
                required: [
                  'reply',
                  'intent',
                  'service',
                  'leadType',
                  'leadScore',
                  'budget',
                  'timeline',
                  'requirements',
                  'summary',
                  'needsHuman',
                  'confidence'
                ]
              }
            }
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gemini request timed out after 10000ms')), 10000)
          )
        ]);

        if (response?.text) {
          const parsed = JSON.parse(response.text.trim());
          const normalized = normalizeAIOutput(parsed, lead);
          console.log(
            '[ai-service] Gemini response received',
            JSON.stringify({
              model: geminiModel,
              durationMs: Date.now() - reqStart,
              intent: normalized.intent,
              leadType: normalized.leadType,
              leadScore: normalized.leadScore
            })
          );
          console.log(`[ai-service] Response generated via Gemini (${geminiModel})`);
          return {
            ...normalized,
            providerUsed: 'GEMINI',
            modelUsed: geminiModel
          };
        }
      } catch (err) {
        console.warn(
          `[ai-service] Gemini model (${geminiModel}) error (${err.status || 'ERR'}) after ${
            Date.now() - reqStart
          }ms: ${err.message?.slice(0, 120) || 'Unknown error'}`
        );
      }
    }
    return null;
  };

  if (preferProvider === 'GEMINI') {
    const geminiResult = await tryGeminiProvider();
    if (geminiResult) return geminiResult;
    const openAiResult = await tryOpenAIProvider();
    if (openAiResult) return openAiResult;
  } else {
    const openAiResult = await tryOpenAIProvider();
    if (openAiResult) return openAiResult;
    const geminiResult = await tryGeminiProvider();
    if (geminiResult) return geminiResult;
  }

  // 3. Deterministic heuristic fallback grounded in DB KnowledgeBase
  console.warn('[ai-service] All AI providers unavailable, using deterministic analyzer.');
  return {
    ...buildDeterministicAIOutput(customerMessage, contact, lead, activeKb),
    providerUsed: 'DETERMINISTIC_FALLBACK',
    modelUsed: 'rule-based'
  };
}

function normalizeAIOutput(parsed, lead) {
  const score = Math.max(0, Math.min(100, Number(parsed.leadScore) || 60));
  const validTypes = ['HOT', 'WARM', 'COLD', 'UNQUALIFIED', 'EXISTING_CUSTOMER'];
  const leadType = validTypes.includes(String(parsed.leadType).toUpperCase())
    ? String(parsed.leadType).toUpperCase()
    : score >= 81
    ? 'HOT'
    : score >= 31
    ? 'WARM'
    : 'COLD';

  return {
    reply:
      parsed.reply ||
      'Thank you for reaching out! Could you share a few details about your required service, budget, and timeline?',
    intent: parsed.intent || 'service_enquiry',
    service: parsed.service || lead?.interestedService || 'General Inquiry',
    leadType,
    leadScore: score,
    budget: parsed.budget || lead?.budget || 'Not disclosed',
    timeline: parsed.timeline || lead?.timeline || 'Not specified',
    requirements: Array.isArray(parsed.requirements)
      ? parsed.requirements
      : lead?.requirements || [],
    summary:
      parsed.summary ||
      'Customer message analyzed and lead qualification updated.',
    needsHuman: Boolean(parsed.needsHuman),
    confidence: Number(parsed.confidence) || 0.9
  };
}

function buildDeterministicAIOutput(content, contact, lead, activeKb) {
  const lower = content.toLowerCase();
  const asksForHuman =
    lower.includes('human') ||
    lower.includes('manager') ||
    lower.includes('agent') ||
    lower.includes('complaint') ||
    lower.includes('refund') ||
    lower.includes('urgent call');

  const isManglish =
    lower.includes('aanu') ||
    lower.includes('undakkanam') ||
    lower.includes('ethra') ||
    lower.includes('pattuo') ||
    lower.includes('cheyyan') ||
    lower.includes('venam');
  const isMalayalam = /[\u0D00-\u0D7F]/.test(content);

  // Match any knowledge base article by keywords
  const matchedKb = activeKb.find((kb) =>
    (kb.keywords || []).some((kw) => lower.includes(kw.toLowerCase()))
  );

  // Extract budget if mentioned
  const budgetMatch = content.match(/(?:₹|rs\.?|inr)\s?[\d,]+(?:\s*(?:lakh|k|cr))?|\d+\s*(?:lakh|k)/i);
  const extractedBudget = budgetMatch ? budgetMatch[0] : lead?.budget || 'Not disclosed';
  const hasBudget = extractedBudget !== 'Not disclosed';

  if (asksForHuman) {
    return {
      reply: isManglish
        ? `Theerchayayum ${contact?.name || ''}! Nammude team manager-ne njan ippo thanne ee chat-ilekku connect cheyyunnu.`
        : `I understand, ${contact?.name || 'there'}. I have escalated your chat to our team so a human specialist can assist you directly right away.`,
      intent: 'human_request',
      service: lead?.interestedService || 'Customer Escalation',
      leadType: 'HOT',
      leadScore: Math.max(lead?.leadScore || 75, 85),
      budget: extractedBudget,
      timeline: 'Immediate',
      requirements: Array.from(new Set([...(lead?.requirements || []), 'Requested human assistance'])),
      summary: `Customer requested human intervention: "${content.slice(0, 80)}"`,
      needsHuman: true,
      confidence: 0.95
    };
  }

  let replyText;
  if (matchedKb) {
    replyText = `${matchedKb.content}\n\nCould you let us know your expected timeline and budget so we can tailor this for you?`;
  } else if (isManglish) {
    replyText = `Hello ${contact?.name || ''}! Njangalkku ningale sahayikkan santhoshamundu. Ningalkku ethu service aanu vendathu, expected budget & timeline ethra aanu ennu onnu parayamo?`;
  } else if (isMalayalam) {
    replyText = `നമസ്കാരം ${contact?.name || ''}! നിങ്ങളുടെ ആവശ്യങ്ങൾക്കനുസരിച്ച് ഞങ്ങൾ സഹായിക്കാം. ഏത് സേവനമാണ് നിങ്ങൾ ഉദ്ദേശിക്കുന്നത്, പ്രതീക്ഷിക്കുന്ന ബജറ്റും സമയപരിധിയും വ്യക്തമാക്കാമോ?`;
  } else {
    replyText = `Hello ${contact?.name?.split(' ')[0] || 'there'}! Thank you for messaging us. Could you share a bit more about the service you are looking for, your target timeline, and estimated budget?`;
  }

  const newScore = hasBudget ? 88 : Math.min(85, (lead?.leadScore || 55) + 10);
  const newType = newScore >= 81 ? 'HOT' : newScore >= 31 ? 'WARM' : 'COLD';

  return {
    reply: replyText,
    intent: hasBudget ? 'purchase_intent' : 'service_enquiry',
    service: matchedKb?.title || lead?.interestedService || 'General Inquiry',
    leadType: newType,
    leadScore: newScore,
    budget: extractedBudget,
    timeline: lower.includes('next month')
      ? 'Next month'
      : lower.includes('urgent') || lower.includes('immediately')
      ? 'Immediate'
      : lead?.timeline || 'Not specified',
    requirements: Array.from(
      new Set([...(lead?.requirements || []), content.slice(0, 60)])
    ),
    summary: `Customer message: "${content.slice(0, 90)}". Qualified as ${newType} (${newScore}/100).`,
    needsHuman: false,
    confidence: 0.9
  };
}

// Helper to process an incoming customer message (used by both Meta Webhook & UI simulator)
async function handleIncomingCustomerMessage({
  conversationId,
  fromPhone,
  senderProfileName,
  content,
  whatsappMessageId,
  languageHint
}) {
  await connectDB();

  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const todayStr = new Date().toISOString().slice(0, 10);

  const lookupStart = Date.now();
  console.log(
    '[pipeline] contact/lead lookup started',
    JSON.stringify({
      fromPhone: fromPhone || 'none',
      conversationId: conversationId || 'none',
      whatsappMessageId: whatsappMessageId || 'none'
    })
  );

  // Deduplicate if the exact same WhatsApp message ID was already processed
  if (whatsappMessageId && String(whatsappMessageId).startsWith('wamid.HBg')) {
    const existingMsg = await Message.findOne({ whatsappMessageId }).lean();
    if (existingMsg) {
      console.warn(
        '[pipeline] duplicate whatsappMessageId ignored',
        JSON.stringify({ whatsappMessageId, existingMsgId: existingMsg.id })
      );
      const conv = await Conversation.findOne({ id: existingMsg.conversationId });
      const lead = conv ? await Lead.findOne({ id: conv.leadId }) : null;
      return { customerMsg: existingMsg, aiMsg: null, conversation: conv, lead, duplicate: true };
    }
  }

  let conv = conversationId ? await Conversation.findOne({ id: conversationId }) : null;
  let contact = null;
  let lead = null;

  if (conv) {
    contact = await Contact.findOne({ id: conv.contactId });
    lead = await Lead.findOne({ id: conv.leadId });
  } else if (fromPhone) {
    // Look up contact by phone suffix
    const digits = String(fromPhone).replace(/[^0-9]/g, '');
    const suffix = digits.slice(-10);
    const allContacts = await Contact.find({});
    contact = allContacts.find((c) => String(c.phone).replace(/[^0-9]/g, '').endsWith(suffix));

    if (!contact) {
      const newContactId = `cnt-${Date.now()}`;
      contact = await Contact.create({
        id: newContactId,
        name: senderProfileName || `WhatsApp User (+${digits})`,
        phone: `+${digits}`,
        email: '',
        company: 'WhatsApp Inquiry',
        location: '',
        preferredLanguage: languageHint || 'English',
        source: 'WhatsApp Inbound',
        tags: ['WhatsApp Inbound'],
        createdAt: todayStr,
        lastInteractionAt: 'Just now',
        totalConversations: 1,
        totalMessages: 1
      });
    }

    conv = await Conversation.findOne({ contactId: contact.id });
    lead = await Lead.findOne({ contactId: contact.id });

    if (!conv) {
      const newConvId = `conv-${Date.now()}`;
      const newLeadId = lead ? lead.id : `ld-${Date.now()}`;

      if (!lead) {
        lead = await Lead.create({
          id: newLeadId,
          contactId: contact.id,
          conversationId: newConvId,
          leadStatus: 'NEW',
          leadType: 'WARM',
          leadScore: 55,
          scoreBreakdown: {
            budgetReadiness: 12,
            needSpecificity: 12,
            timelineUrgency: 10,
            decisionAuthority: 8,
            engagementDepth: 8
          },
          interestedService: 'WhatsApp Inquiry',
          budget: 'Not disclosed',
          estimatedValueInr: 0,
          timeline: 'Not specified',
          requirements: [content.slice(0, 80)],
          buyingSignals: ['Inbound WhatsApp message received'],
          detectedObjections: [],
          recommendedNextAction: 'Review customer requirements and send initial response.',
          source: 'WhatsApp Inbound',
          assignedAgentId: 'admin-1',
          aiSummary: `New WhatsApp inquiry from ${contact.name}: "${content.slice(0, 80)}"`,
          purchaseIntent: false,
          lastInteractionAt: 'Just now',
          createdAt: todayStr,
          updatedAt: todayStr,
          notes: []
        });
      }

      conv = await Conversation.create({
        id: newConvId,
        contactId: contact.id,
        leadId: lead.id,
        assignedAgentId: 'admin-1',
        status: 'OPEN',
        aiEnabled: true,
        humanTakeoverActive: false,
        humanAttentionRecommended: false,
        needsHumanAttention: false,
        unreadCount: 1,
        lastMessage: content,
        lastMessageTime: nowStr,
        language: languageHint || 'English',
        keyFinding: `New inquiry: "${content.slice(0, 65)}"`
      });
    }
  }

  if (!conv) {
    throw new Error('Conversation not found');
  }

  console.log(
    '[pipeline] contact/lead lookup completed',
    JSON.stringify({
      contactId: contact?.id || 'none',
      conversationId: conv.id,
      leadId: lead?.id || 'none',
      durationMs: Date.now() - lookupStart
    })
  );

  // Save Customer Message in MongoDB
  const customerMsg = await Message.create({
    id: `msg-cust-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    conversationId: conv.id,
    whatsappMessageId: whatsappMessageId || `wamid.in.${Date.now()}`,
    senderType: 'CUSTOMER',
    senderName: contact?.name || senderProfileName || 'Customer',
    content: content.trim(),
    timestamp: nowStr,
    deliveryStatus: 'READ'
  });

  if (contact) {
    contact.lastInteractionAt = 'Just now';
    contact.totalMessages = (contact.totalMessages || 0) + 1;
    await contact.save();
  }

  // Load AI Settings and Knowledge Base
  const aiSettingDoc = await Setting.findOne({ type: 'aiSettings' });
  const aiSettings = aiSettingDoc?.data || INITIAL_AI_SETTINGS;

  // Explicit manual human takeover state check:
  // ONLY manual human takeover (humanTakeoverActive === true or aiEnabled === false set by human)
  // or global AI settings can skip AI auto-reply.
  // AI recommendations (humanAttentionRecommended / needsHumanAttention) MUST NEVER pause AI replies.
  const humanTakeoverActive = Boolean(conv.humanTakeoverActive) || conv.aiEnabled === false;
  const convAiEnabled = !humanTakeoverActive;

  console.log(
    '[pipeline] AI processing started',
    JSON.stringify({
      conversationId: conv.id,
      convAiEnabled,
      humanTakeoverActive,
      humanAttentionRecommended: Boolean(conv.humanAttentionRecommended ?? conv.needsHumanAttention),
      globalAiEnabled: Boolean(aiSettings.aiEnabled),
      autoReplyEnabled: Boolean(aiSettings.autoReplyEnabled),
      configuredProvider: aiSettings.provider || process.env.AI_PROVIDER || 'GEMINI',
      configuredModel: aiSettings.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
    })
  );

  if (!convAiEnabled || !aiSettings.aiEnabled || !aiSettings.autoReplyEnabled) {
    console.warn(
      '[pipeline] AI auto-reply skipped (manual human takeover active or global AI disabled)',
      JSON.stringify({
        conversationId: conv.id,
        convAiEnabled,
        humanTakeoverActive,
        globalAiEnabled: aiSettings.aiEnabled,
        autoReplyEnabled: aiSettings.autoReplyEnabled
      })
    );
    conv.lastMessage = content.trim();
    conv.lastMessageTime = nowStr;
    conv.unreadCount = (conv.unreadCount || 0) + 1;
    await conv.save();
    return { customerMsg, aiMsg: null, conversation: conv, lead };
  }

  const historyMessages = await Message.find({ conversationId: conv.id }).sort({ createdAt: 1 });
  const knowledgeBase = await KnowledgeBase.find({});

  const aiStructured = await generateAIQualificationAndReply({
    customerMessage: content.trim(),
    contact,
    lead,
    historyMessages,
    knowledgeBase,
    aiSettings
  });

  // If this came from real WhatsApp or has a valid phone, attempt Cloud API send
  let deliveryStatus = 'DELIVERED';
  let outWamid = `wamid.ai.${Date.now()}`;
  if (contact?.phone) {
    const waRes = await sendWhatsAppCloudMessage(contact.phone, aiStructured.reply);
    if (waRes.sent && waRes.whatsappMessageId) {
      outWamid = waRes.whatsappMessageId;
      deliveryStatus = 'SENT';
    } else {
      deliveryStatus = 'FAILED';
    }
  }

  const aiMsg = await Message.create({
    id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    conversationId: conv.id,
    whatsappMessageId: outWamid,
    senderType: 'AI',
    senderName: 'PulseFlow AI Assistant',
    content: aiStructured.reply,
    timestamp: nowStr,
    deliveryStatus,
    aiMetadata: aiStructured
  });

  // Update Conversation in MongoDB
  // CRITICAL PRODUCT RULE: AI recommendation MUST NEVER disable AI or activate human takeover.
  // aiEnabled remains true and humanTakeoverActive remains false until human clicks "Take Over Chat".
  const recommended = Boolean(aiStructured.needsHuman);
  conv.lastMessage = aiStructured.reply;
  conv.lastMessageTime = nowStr;
  conv.aiEnabled = true;
  conv.humanTakeoverActive = false;
  conv.status = 'OPEN';
  conv.humanAttentionRecommended = recommended;
  conv.needsHumanAttention = recommended;
  conv.keyFinding = aiStructured.summary;
  if (languageHint) conv.language = languageHint;
  if (recommended) {
    conv.handoffReason = 'Customer may need human attention';
  } else {
    conv.handoffReason = '';
  }
  await conv.save();

  // Update Lead in MongoDB
  if (lead) {
    const prevScore = Number(lead.leadScore ?? 50);
    const prevType =
      lead.leadType || (prevScore >= 81 ? 'HOT' : prevScore >= 31 ? 'WARM' : 'COLD');
    const wasHot = prevType === 'HOT' || prevScore >= 81;

    const nextScore = Number(aiStructured.leadScore ?? prevScore);
    const nextType =
      nextScore >= 81
        ? 'HOT'
        : aiStructured.leadType && aiStructured.leadType !== 'HOT'
        ? aiStructured.leadType
        : nextScore >= 31
        ? 'WARM'
        : 'COLD';
    const isNowHot = nextScore >= 81 || nextType === 'HOT';

    const numericBudget =
      parseInt(String(aiStructured.budget).replace(/[^0-9]/g, ''), 10) ||
      lead.estimatedValueInr ||
      0;

    if (!wasHot && isNowHot) {
      const nowMs = Date.now();
      lead.previousLeadStatus = lead.leadStatus || 'NEW';
      lead.previousLeadType = prevType;
      lead.lastHotTransitionAt = nowMs;
      lead.hotLeadNotifiedAt = nowMs;
      lead.hotLeadAcknowledgedAt = 0;
      lead.hotLeadAcknowledgedBy = {};

      await Notification.create({
        id: `notif-hot-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'HOT_LEAD',
        title: '🔥 Hot Lead Alert',
        message: `${contact?.name || 'Customer'} reached ${nextScore}/100 (HOT) for ${
          aiStructured.service || lead.interestedService || 'Inquiry'
        }.`,
        createdAt: 'Just now',
        isRead: false,
        linkTo: `/leads/${lead.id}`
      });
    } else if (wasHot && !isNowHot) {
      lead.previousLeadStatus = lead.leadStatus || 'NEW';
      lead.previousLeadType = 'HOT';
      lead.lastHotTransitionAt = 0;
    }

    lead.leadScore = nextScore;
    lead.leadType = nextType;
    lead.interestedService = aiStructured.service || lead.interestedService;
    lead.budget = aiStructured.budget || lead.budget;
    if (numericBudget > 0) lead.estimatedValueInr = numericBudget;
    lead.timeline = aiStructured.timeline || lead.timeline;
    lead.requirements = aiStructured.requirements;
    lead.scoreBreakdown = {
      budgetReadiness: Math.min(25, Math.round(aiStructured.leadScore * 0.25)),
      needSpecificity: Math.min(25, Math.round(aiStructured.leadScore * 0.25)),
      timelineUrgency: Math.min(20, Math.round(aiStructured.leadScore * 0.2)),
      decisionAuthority: Math.min(15, Math.round(aiStructured.leadScore * 0.15)),
      engagementDepth: Math.min(15, Math.round(aiStructured.leadScore * 0.15))
    };
    lead.buyingSignals = Array.from(
      new Set([
        ...(lead.buyingSignals || []),
        `AI Intent: ${aiStructured.intent} (${Math.round((aiStructured.confidence || 0.9) * 100)}% confidence)`
      ])
    );
    lead.aiSummary = aiStructured.summary;
    lead.purchaseIntent = aiStructured.leadScore >= 75 || aiStructured.intent === 'purchase_intent';
    lead.lastInteractionAt = 'Just now';
    lead.updatedAt = todayStr;
    await lead.save();
  }

  if (recommended) {
    await Notification.create({
      id: `notif-${Date.now()}`,
      type: 'HUMAN_ATTENTION',
      title: 'Customer May Need Human Attention',
      message: `${contact?.name || 'Customer'} may benefit from human review. AI Assistant is still replying automatically.`,
      createdAt: 'Just now',
      isRead: false,
      linkTo: `/inbox?convId=${conv.id}`
    });
  }

  return { customerMsg, aiMsg, conversation: conv, lead, aiStructured };
}

// Defensive extraction for Meta Webhook payloads
function extractEvents(payload) {
  const events = [];
  if (!payload || typeof payload !== 'object') return events;

  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value ?? {};
      const contactsArr = Array.isArray(value.contacts) ? value.contacts : [];
      const profileName = contactsArr[0]?.profile?.name ?? null;
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];

      for (const message of messages) {
        const textBody =
          message?.text?.body ||
          message?.button?.text ||
          message?.interactive?.button_reply?.title ||
          message?.interactive?.list_reply?.title ||
          '';

        events.push({
          kind: 'message',
          field: change?.field ?? 'messages',
          messageId: message?.id ?? null,
          from: message?.from ?? null,
          profileName,
          type: message?.type ?? 'unknown',
          text: textBody,
          timestamp: message?.timestamp ?? null
        });
      }

      for (const status of statuses) {
        events.push({
          kind: 'status',
          field: change?.field ?? 'statuses',
          messageId: status?.id ?? null,
          recipient: status?.recipient_id ?? null,
          state: status?.status ?? null,
          timestamp: status?.timestamp ?? null
        });
      }

      // Support WhatsApp Business App + Cloud API Coexistence outbound message echoes (smb_message_echoes)
      const messageEchoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];
      for (const echo of messageEchoes) {
        const echoText =
          echo?.text?.body ||
          echo?.image?.caption ||
          echo?.video?.caption ||
          echo?.document?.caption ||
          (echo?.type && echo.type !== 'text'
            ? `[${String(echo.type).toUpperCase()} sent from WhatsApp Business App]`
            : '');

        events.push({
          kind: 'smb_message_echo',
          field: change?.field ?? 'smb_message_echoes',
          messageId: echo?.id ?? null,
          from: echo?.from ?? null,
          to: echo?.to ?? null,
          type: echo?.type ?? 'text',
          text: echoText,
          timestamp: echo?.timestamp ?? null
        });
      }
    }
  }

  return events;
}

// Handle WhatsApp Business App Coexistence outbound message echo (smb_message_echoes)
// Records messages sent from the mobile WhatsApp Business App into the CRM conversation
// WITHOUT triggering an AI auto-reply.
async function handleSmbMessageEcho(ev) {
  const recipientDigits = String(ev?.to || '').replace(/[^0-9]/g, '');
  const content = String(ev?.text || '').trim();
  if (!recipientDigits || !content) {
    return { skipped: true, reason: 'missing_recipient_or_text' };
  }

  if (ev.messageId) {
    const existing = await Message.findOne({ whatsappMessageId: ev.messageId });
    if (existing) {
      return { skipped: true, reason: 'duplicate_echo_id' };
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Find or create customer Contact using recipient number (to)
  const allContacts = await Contact.find({});
  let contact = allContacts.find((c) => {
    const cDigits = String(c.phone || '').replace(/[^0-9]/g, '');
    if (!cDigits) return false;
    return (
      cDigits === recipientDigits ||
      (cDigits.length >= 10 &&
        recipientDigits.length >= 10 &&
        cDigits.slice(-10) === recipientDigits.slice(-10))
    );
  });

  if (!contact) {
    contact = await Contact.create({
      id: `cnt-${Date.now()}`,
      name: `WhatsApp Customer (${recipientDigits.slice(-4)})`,
      phone: `+${recipientDigits}`,
      email: '',
      company: '',
      roleTitle: '',
      location: '',
      preferredLanguage: 'English',
      bestTimeToContact: 'Anytime',
      source: 'WhatsApp Business App (Coexistence)',
      tags: ['WhatsApp Coexistence'],
      notes: [],
      createdAt: todayStr,
      lastInteractionAt: 'Just now',
      totalConversations: 1,
      totalMessages: 0
    });
  }

  // 2. Find or create Lead & Conversation for this customer
  let conv = await Conversation.findOne({ contactId: contact.id });
  let lead = await Lead.findOne({ contactId: contact.id });

  if (!lead) {
    const leadId = `ld-${Date.now()}`;
    lead = await Lead.create({
      id: leadId,
      contactId: contact.id,
      conversationId: conv ? conv.id : '',
      leadStatus: 'CONTACTED',
      leadType: 'WARM',
      leadScore: 50,
      scoreBreakdown: {
        budgetReadiness: 12,
        needSpecificity: 12,
        timelineUrgency: 10,
        decisionAuthority: 8,
        engagementDepth: 8
      },
      interestedService: 'WhatsApp Inquiry',
      budget: 'Not disclosed',
      estimatedValueInr: 0,
      timeline: 'Not specified',
      requirements: [],
      buyingSignals: ['Contacted via WhatsApp Business App (Coexistence)'],
      detectedObjections: [],
      recommendedNextAction: 'Continue conversation or review customer reply.',
      source: 'WhatsApp Business App (Coexistence)',
      assignedAgentId: 'admin-1',
      aiSummary: `Active WhatsApp Business App conversation with ${contact.name}.`,
      purchaseIntent: false,
      lastInteractionAt: 'Just now',
      createdAt: todayStr,
      updatedAt: todayStr,
      notes: []
    });
  }

  if (!conv) {
    const convId = `conv-${Date.now()}`;
    conv = await Conversation.create({
      id: convId,
      contactId: contact.id,
      leadId: lead.id,
      assignedAgentId: lead.assignedAgentId || 'admin-1',
      status: 'OPEN',
      aiEnabled: true,
      humanTakeoverActive: false,
      humanAttentionRecommended: false,
      needsHumanAttention: false,
      unreadCount: 0,
      lastMessage: content,
      lastMessageTime: nowStr,
      language: contact.preferredLanguage || 'English',
      keyFinding: 'Outbound message synced from WhatsApp Business mobile app (Coexistence)'
    });
    lead.conversationId = conv.id;
    await lead.save();
  } else {
    conv.lastMessage = content;
    conv.lastMessageTime = nowStr;
    await conv.save();
  }

  // 3. Append echoed message marked as BUSINESS_MOBILE_ECHO (does NOT trigger AI auto-reply)
  const echoMsg = await Message.create({
    id: `msg-echo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId: conv.id,
    whatsappMessageId: ev.messageId || `wamid.echo.${Date.now()}`,
    senderType: 'BUSINESS_MOBILE_ECHO',
    senderName: 'WhatsApp Business App (Mobile Echo)',
    content,
    timestamp: nowStr,
    deliveryStatus: 'SENT'
  });

  contact.lastInteractionAt = 'Just now';
  contact.totalMessages = (contact.totalMessages || 0) + 1;
  await contact.save();

  console.log(
    '[webhook] smb_message_echoes recorded in CRM conversation without AI auto-reply',
    JSON.stringify({
      conversationId: conv.id,
      contactId: contact.id,
      to: maskPhoneNumber(recipientDigits),
      messageId: echoMsg.whatsappMessageId
    })
  );

  return { skipped: false, echoMsg, conversation: conv, contact };
}

app.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    database: dbStatusMap[dbState] || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// Meta webhook verification handler (supports both /webhook and /api/webhooks/whatsapp)
// Resolves verify token from encrypted MongoDB SystemConfig first, with ENV fallback
async function handleWebhookVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const tokenStr = Array.isArray(token)
    ? String(token[token.length - 1] ?? '')
    : String(token ?? '');

  const sysCfg = await getRuntimeSystemConfig(req);
  const activeVerifyToken = sysCfg.whatsappVerifyToken;

  if (mode === 'subscribe' && activeVerifyToken && safeCompare(tokenStr, activeVerifyToken)) {
    return res.status(200).type('text/plain').send(String(challenge));
  }

  console.warn(
    '[webhook] verification rejected',
    JSON.stringify({
      mode: mode === 'subscribe' ? 'subscribe' : 'unexpected-mode',
      verifyTokenConfigured: Boolean(activeVerifyToken),
      challengeProvided: challenge !== undefined
    })
  );

  return res.sendStatus(403);
}

async function handleWebhookPost(req, res) {
  const sysCfg = await getRuntimeSystemConfig(req);
  const signature = verifySignature(req, sysCfg.metaAppSecret);
  console.log(
    '[webhook] received',
    JSON.stringify({
      path: req.path,
      signatureValid: signature.ok,
      signatureReason: signature.reason
    })
  );

  if (!signature.ok) {
    const unconfigured = signature.reason === 'app-secret-not-configured';

    if (unconfigured && !IS_PRODUCTION) {
      console.warn(
        '[webhook] META_APP_SECRET not set — signature check skipped (non-production only)'
      );
    } else if (unconfigured) {
      console.error('[webhook] META_APP_SECRET missing in production — rejecting request');
      return res.sendStatus(503);
    } else {
      console.warn('[webhook] rejected POST', JSON.stringify({ reason: signature.reason }));
      return res.sendStatus(401);
    }
  }

  // Acknowledge immediately for Meta
  res.status(200).send('EVENT_RECEIVED');

  try {
    await connectDB();

    const events = extractEvents(req.body);
    console.log(
      '[webhook] events received',
      JSON.stringify({ count: events.length, events: events.slice(0, 25) })
    );

    for (const ev of events) {
      try {
        if (ev.kind === 'message') {
          console.log(
            '[webhook] message extracted',
            JSON.stringify({
              messageId: ev.messageId,
              from: ev.from,
              type: ev.type,
              hasText: Boolean(ev.text),
              textLength: String(ev.text || '').length
            })
          );

          if (ev.from && ev.text) {
            await handleIncomingCustomerMessage({
              fromPhone: ev.from,
              senderProfileName: ev.profileName,
              content: ev.text,
              whatsappMessageId: ev.messageId
            });
          } else {
            console.warn(
              '[webhook] message skipped (no text content or sender phone)',
              JSON.stringify({ messageId: ev.messageId, type: ev.type, from: ev.from })
            );
          }
        } else if (ev.kind === 'smb_message_echo') {
          await handleSmbMessageEcho(ev);
        } else if (ev.kind === 'status' && ev.messageId && ev.state) {
          const statusUpper = String(ev.state).toUpperCase();
          if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(statusUpper)) {
            await Message.findOneAndUpdate(
              { whatsappMessageId: ev.messageId },
              { deliveryStatus: statusUpper }
            );
          }
        }
      } catch (eventErr) {
        console.error(
          '[webhook] error processing individual event',
          JSON.stringify({
            kind: ev.kind,
            messageId: ev.messageId,
            error: eventErr?.message || 'unknown error'
          })
        );
      }
    }

    await Setting.findOneAndUpdate(
      { type: 'whatsappSettings' },
      { $set: { 'data.lastWebhookAt': new Date().toLocaleTimeString() } }
    );
  } catch (error) {
    console.error('[webhook] failed to process payload', error?.message ?? 'unknown error');
  }
}

app.get('/webhook', handleWebhookVerify);
app.post('/webhook', handleWebhookPost);
app.get('/api/webhooks/whatsapp', handleWebhookVerify);
app.post('/api/webhooks/whatsapp', handleWebhookPost);

// Sanitize WhatsAppAccount document so accessToken is NEVER sent to the client
// Strictly uses verified database state — never invents fake WABA ID, Phone Number ID, or Business Name.
function buildSanitizedWhatsAppConnection({
  waAccount,
  aiSettings = INITIAL_AI_SETTINGS,
  webhookUrl = '',
  webhookReady = false
}) {
  const connectionStatus =
    waAccount?.connectionStatus ||
    (waAccount?.status === 'CONNECTED'
      ? 'CONNECTED'
      : waAccount?.status === 'ERROR'
      ? 'ERROR'
      : 'NOT_CONNECTED');

  const isConnected =
    connectionStatus === 'CONNECTED' &&
    Boolean(waAccount?.wabaId) &&
    Boolean(waAccount?.phoneNumberId) &&
    Boolean(waAccount?.messagingActive === true) &&
    Boolean(waAccount?.webhookSubscribed === true);

  const rawPhone = isConnected ? String(waAccount?.displayPhoneNumber || '').trim() : '';
  const rawPhoneId = isConnected ? String(waAccount?.phoneNumberId || '').trim() : '';
  const rawWabaId = isConnected ? String(waAccount?.wabaId || '').trim() : '';
  const businessPortfolioId = isConnected
    ? String(waAccount?.businessPortfolioId || waAccount?.businessId || '').trim()
    : '';
  const businessName = isConnected ? String(waAccount?.businessName || '').trim() : '';
  const verifiedName = isConnected ? String(waAccount?.verifiedName || '').trim() : '';
  const wabaName = isConnected ? String(waAccount?.wabaName || '').trim() : '';

  const coexistenceStatus = isConnected
    ? waAccount?.coexistenceStatus || (waAccount?.isOnBizApp ? 'CONNECTED' : 'NOT_ELIGIBLE')
    : 'NOT_ELIGIBLE';

  return {
    status: isConnected ? 'CONNECTED' : connectionStatus === 'ERROR' ? 'ERROR' : 'NOT_CONNECTED',
    connectionStatus: isConnected
      ? 'CONNECTED'
      : connectionStatus === 'ERROR'
      ? 'ERROR'
      : 'NOT_CONNECTED',
    connected: Boolean(isConnected),
    onboardingMode: waAccount?.onboardingMode || 'COEXISTENCE',
    coexistenceStatus,
    coexistenceEligible: isConnected ? coexistenceStatus === 'CONNECTED' : null,
    coexistenceStatusNote: isConnected ? waAccount?.coexistenceStatusNote || '' : '',
    isOnBizApp: Boolean(isConnected && waAccount?.isOnBizApp),
    platformType: isConnected ? waAccount?.platformType || '' : '',
    businessPortfolioId,
    businessId: businessPortfolioId,
    businessName,
    wabaId: rawWabaId,
    maskedWabaId: maskIdentifier(rawWabaId),
    wabaName,
    phoneNumberId: rawPhoneId,
    maskedPhoneNumberId: maskIdentifier(rawPhoneId),
    displayPhoneNumber: rawPhone,
    maskedPhone: maskPhoneNumber(rawPhone),
    verifiedName,
    qualityRating: isConnected ? waAccount?.qualityRating || '' : '',
    messagingActive: Boolean(isConnected && waAccount?.messagingActive === true),
    webhookSubscribed: Boolean(isConnected && waAccount?.webhookSubscribed === true),
    webhookConnected: Boolean(isConnected && waAccount?.webhookSubscribed === true),
    webhookVerifyTokenConfigured: Boolean(webhookReady),
    aiAutomationEnabled: Boolean(
      isConnected && aiSettings?.aiEnabled && aiSettings?.autoReplyEnabled
    ),
    webhookUrl,
    connectedByUserId: waAccount?.connectedByUserId || '',
    connectedBy: waAccount?.connectedBy || '',
    connectedAt: isConnected ? waAccount?.connectedAt || '' : '',
    updatedAt: waAccount?.updatedAt || '',
    lastVerifiedAt: isConnected ? waAccount?.lastVerifiedAt || '' : '',
    lastError: waAccount?.lastError || ''
  };
}

// Public Meta Embedded Signup configuration endpoint (never exposes secrets or tokens)
app.get('/api/whatsapp/embedded-config', async (req, res) => {
  try {
    const sysCfg = await getRuntimeSystemConfig(req);
    const sanitizedSys = buildSanitizedSystemConfig(sysCfg);
    const waAccount = await WhatsAppAccount.findOne({ id: 'primary' });
    const aiSettingDoc = await Setting.findOne({ type: 'aiSettings' });

    res.json({
      appId: sanitizedSys.metaAppId,
      configId: sanitizedSys.embeddedSignupConfigId,
      apiVersion: sanitizedSys.whatsappApiVersion,
      publicAppUrl: sanitizedSys.publicAppUrl,
      frontendUrl: sanitizedSys.frontendUrl,
      webhookUrl: sanitizedSys.webhookUrl,
      appSecretConfigured: sanitizedSys.metaAppSecretConfigured,
      appSecretStoredInDb: sanitizedSys.metaAppSecretStoredInDb,
      verifyTokenConfigured: sanitizedSys.whatsappVerifyTokenConfigured,
      verifyTokenStoredInDb: sanitizedSys.whatsappVerifyTokenStoredInDb,
      sdkReadyToLaunch: sanitizedSys.sdkReadyToLaunch,
      metaConfigurationPresent: sanitizedSys.metaConfigurationPresent,
      missingConfigVars: sanitizedSys.missingConfigVars,
      configurationStatus: sanitizedSys.configurationStatus,
      connection: buildSanitizedWhatsAppConnection({
        waAccount,
        aiSettings: aiSettingDoc?.data || INITIAL_AI_SETTINGS,
        webhookUrl: sanitizedSys.webhookUrl,
        webhookReady: sanitizedSys.whatsappVerifyTokenConfigured
      })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Meta Embedded Signup & WhatsApp Configuration in MongoDB (Protected: Admin only)
// Encrypts sensitive secrets (metaAppSecret, whatsappVerifyToken) using AES-256-GCM before storing.
app.post('/api/whatsapp/embedded-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    await connectDB();
    const metaAppId = String(req.body?.metaAppId || '').trim();
    const embeddedSignupConfigId = String(req.body?.embeddedSignupConfigId || '').trim();
    const metaAppSecretPlain = String(req.body?.metaAppSecret || '').trim();
    const verifyTokenPlain = String(
      req.body?.whatsappVerifyToken || req.body?.verifyToken || ''
    ).trim();
    const publicAppUrlInput = String(req.body?.publicAppUrl || '').trim();
    const whatsappApiVersionInput = String(req.body?.whatsappApiVersion || '').trim();

    if (!metaAppId || !embeddedSignupConfigId) {
      return res.status(400).json({
        ok: false,
        status: 'ERROR',
        error:
          'Both Meta App ID (META_APP_ID) and Embedded Signup Configuration ID (META_EMBEDDED_SIGNUP_CONFIG_ID) are required.'
      });
    }

    const nowIso = new Date().toISOString();
    const sysUpdates = {
      metaAppId,
      embeddedSignupConfigId,
      updatedBy: req.authUser?.email || req.authUser?.name || 'Admin',
      updatedAt: nowIso
    };
    if (publicAppUrlInput) {
      sysUpdates.publicAppUrl = publicAppUrlInput.replace(/\/+$/, '');
    }
    if (whatsappApiVersionInput) {
      let ver = whatsappApiVersionInput.replace(/['"]/g, '').replace(/^\/+|\/+$/g, '');
      if (!ver.startsWith('v')) ver = `v${ver}`;
      sysUpdates.whatsappApiVersion = ver;
    }
    if (metaAppSecretPlain) {
      sysUpdates.metaAppSecretEncrypted = encryptSecret(metaAppSecretPlain);
    }
    if (verifyTokenPlain) {
      sysUpdates.whatsappVerifyTokenEncrypted = encryptSecret(verifyTokenPlain);
    }

    await SystemConfig.findOneAndUpdate(
      { id: 'primary' },
      { $set: sysUpdates },
      { upsert: true, new: true }
    );

    await WhatsAppAccount.findOneAndUpdate(
      { id: 'primary' },
      {
        $set: {
          metaAppId,
          embeddedSignupConfigId,
          updatedAt: nowIso
        }
      },
      { upsert: true, new: true }
    );

    const updatedSysCfg = await getRuntimeSystemConfig(req);
    const sanitizedSys = buildSanitizedSystemConfig(updatedSysCfg);

    res.json({
      ok: true,
      appId: sanitizedSys.metaAppId,
      configId: sanitizedSys.embeddedSignupConfigId,
      apiVersion: sanitizedSys.whatsappApiVersion,
      publicAppUrl: sanitizedSys.publicAppUrl,
      webhookUrl: sanitizedSys.webhookUrl,
      appSecretConfigured: sanitizedSys.metaAppSecretConfigured,
      verifyTokenConfigured: sanitizedSys.whatsappVerifyTokenConfigured,
      metaConfigurationPresent: sanitizedSys.metaConfigurationPresent,
      sdkReadyToLaunch: sanitizedSys.sdkReadyToLaunch,
      config: sanitizedSys
    });
  } catch (err) {
    res.status(500).json({ ok: false, status: 'ERROR', error: err.message });
  }
});

// ============================================================================
// ADMIN SYSTEM & INTEGRATION CONFIGURATION ENDPOINTS (Protected: Admin only)
// Stores application settings in MongoDB with AES-256-GCM encryption for secrets.
// Never returns raw secrets to the client.
// ============================================================================
async function handleGetAdminConfig(req, res) {
  try {
    const runtimeCfg = await getRuntimeSystemConfig(req);
    const sanitized = buildSanitizedSystemConfig(runtimeCfg);
    return res.json({
      ok: true,
      config: sanitized
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function handleUpdateAdminConfig(req, res) {
  try {
    await connectDB();
    const body = req.body || {};
    const nowIso = new Date().toISOString();
    const existing =
      (await SystemConfig.findOne({ id: 'primary' })) || { ...INITIAL_SYSTEM_CONFIG };

    const updates = {
      updatedBy: req.authUser?.email || req.authUser?.name || 'Admin',
      updatedAt: nowIso
    };

    if (typeof body.publicAppUrl === 'string' && body.publicAppUrl.trim()) {
      updates.publicAppUrl = body.publicAppUrl.trim().replace(/\/+$/, '');
    } else if (typeof body.appUrl === 'string' && body.appUrl.trim()) {
      updates.publicAppUrl = body.appUrl.trim().replace(/\/+$/, '');
    }

    if (typeof body.frontendUrl === 'string' && body.frontendUrl.trim()) {
      updates.frontendUrl = body.frontendUrl.trim().replace(/\/+$/, '');
    }

    if (typeof body.metaAppId === 'string') {
      updates.metaAppId = body.metaAppId.trim();
    }

    if (typeof body.embeddedSignupConfigId === 'string') {
      updates.embeddedSignupConfigId = body.embeddedSignupConfigId.trim();
    }

    if (typeof body.whatsappApiVersion === 'string' && body.whatsappApiVersion.trim()) {
      let ver = body.whatsappApiVersion.trim().replace(/['"]/g, '').replace(/^\/+|\/+$/g, '');
      if (!ver.startsWith('v')) ver = `v${ver}`;
      updates.whatsappApiVersion = ver;
    }

    if (typeof body.aiProvider === 'string' && body.aiProvider.trim()) {
      const prov = body.aiProvider.trim().toUpperCase();
      if (prov === 'GEMINI' || prov === 'OPENAI') {
        updates.aiProvider = prov;
      }
    }

    if (typeof body.geminiModel === 'string' && body.geminiModel.trim()) {
      updates.geminiModel = body.geminiModel.trim();
    }

    if (typeof body.openaiModel === 'string' && body.openaiModel.trim()) {
      updates.openaiModel = body.openaiModel.trim();
    }

    // Encrypt sensitive secrets with AES-256-GCM before saving to MongoDB
    if (body.clearMetaAppSecret === true) {
      updates.metaAppSecretEncrypted = '';
    } else if (typeof body.metaAppSecret === 'string' && body.metaAppSecret.trim()) {
      updates.metaAppSecretEncrypted = encryptSecret(body.metaAppSecret.trim());
    }

    const rawVerifyTokenInput =
      typeof body.whatsappVerifyToken === 'string'
        ? body.whatsappVerifyToken
        : typeof body.verifyToken === 'string'
        ? body.verifyToken
        : '';
    if (body.clearWhatsappVerifyToken === true) {
      updates.whatsappVerifyTokenEncrypted = '';
    } else if (rawVerifyTokenInput && rawVerifyTokenInput.trim()) {
      updates.whatsappVerifyTokenEncrypted = encryptSecret(rawVerifyTokenInput.trim());
    }

    if (body.clearGeminiApiKey === true) {
      updates.geminiApiKeyEncrypted = '';
    } else if (typeof body.geminiApiKey === 'string' && body.geminiApiKey.trim()) {
      updates.geminiApiKeyEncrypted = encryptSecret(body.geminiApiKey.trim());
    }

    if (body.clearOpenaiApiKey === true) {
      updates.openaiApiKeyEncrypted = '';
    } else if (typeof body.openaiApiKey === 'string' && body.openaiApiKey.trim()) {
      updates.openaiApiKeyEncrypted = encryptSecret(body.openaiApiKey.trim());
    }

    await SystemConfig.findOneAndUpdate(
      { id: 'primary' },
      { $set: updates },
      { upsert: true, new: true }
    );

    // Sync public Meta IDs to WhatsAppAccount
    if (updates.metaAppId !== undefined || updates.embeddedSignupConfigId !== undefined) {
      const waSync = { updatedAt: nowIso };
      if (updates.metaAppId !== undefined) waSync.metaAppId = updates.metaAppId;
      if (updates.embeddedSignupConfigId !== undefined) {
        waSync.embeddedSignupConfigId = updates.embeddedSignupConfigId;
      }
      await WhatsAppAccount.findOneAndUpdate(
        { id: 'primary' },
        { $set: waSync },
        { upsert: true }
      );
    }

    // Sync webhookUrl to whatsappSettings (without any verifyToken or n8n fields)
    const nextPublicUrl = updates.publicAppUrl || existing.publicAppUrl;
    if (nextPublicUrl) {
      await Setting.findOneAndUpdate(
        { type: 'whatsappSettings' },
        { $set: { 'data.webhookUrl': `${nextPublicUrl.replace(/\/+$/, '')}/webhook` } },
        { upsert: true }
      );
    }

    // Sync active AI provider & model to aiSettings
    if (updates.aiProvider || updates.geminiModel || updates.openaiModel) {
      const activeProv = updates.aiProvider || existing.aiProvider || 'GEMINI';
      const activeModel =
        activeProv === 'OPENAI'
          ? updates.openaiModel || existing.openaiModel || 'gpt-4o-mini'
          : updates.geminiModel || existing.geminiModel || 'gemini-3.5-flash-lite';
      await Setting.findOneAndUpdate(
        { type: 'aiSettings' },
        {
          $set: {
            'data.provider': activeProv,
            'data.model': activeModel
          }
        },
        { upsert: true }
      );
    }

    const runtimeCfg = await getRuntimeSystemConfig(req);
    const sanitized = buildSanitizedSystemConfig(runtimeCfg);

    return res.json({
      ok: true,
      config: sanitized
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

app.get('/api/admin/config', requireAuth, requireAdmin, handleGetAdminConfig);
app.post('/api/admin/config', requireAuth, requireAdmin, handleUpdateAdminConfig);
app.patch('/api/admin/config', requireAuth, requireAdmin, handleUpdateAdminConfig);
app.put('/api/admin/config', requireAuth, requireAdmin, handleUpdateAdminConfig);
app.get('/api/settings/system', requireAuth, requireAdmin, handleGetAdminConfig);
app.post('/api/settings/system', requireAuth, requireAdmin, handleUpdateAdminConfig);
app.patch('/api/settings/system', requireAuth, requireAdmin, handleUpdateAdminConfig);
app.get('/api/settings/integrations', requireAuth, requireAdmin, handleGetAdminConfig);
app.patch('/api/settings/integrations', requireAuth, requireAdmin, handleUpdateAdminConfig);

// Complete Meta WhatsApp Embedded Signup & Real Graph API Verification (Protected: Admin only)
// Priority Rules:
// 1. NEVER fake or simulate onboarding.
// 2. Require real Meta OAuth code exchange + Graph API verification.
// 3. Verify WABA webhook subscription via POST /{WABA-ID}/subscribed_apps AND GET /{WABA-ID}/subscribed_apps.
// 4. For Coexistence (FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING): DO NOT call /register; trigger smb_app_data state & history sync.
app.post('/api/whatsapp/embedded-signup/complete', requireAuth, requireAdmin, async (req, res) => {
  try {
    await connectDB();
    const {
      code,
      wabaId: inputWabaId,
      phoneNumberId: inputPhoneNumberId,
      businessId: inputBusinessId,
      sessionEvent = '',
      onboardingMode = 'COEXISTENCE',
      pin = '',
      redirectUri = ''
    } = req.body || {};

    const sysCfg = await getRuntimeSystemConfig(req);
    const existingAccount = await WhatsAppAccount.findOne({ id: 'primary' });
    const aiSettingDoc = await Setting.findOne({ type: 'aiSettings' });
    const aiSettings = aiSettingDoc?.data || INITIAL_AI_SETTINGS;

    const webhookUrl = sysCfg.webhookUrl;

    const failOnboarding = async (httpStatus, humanError, coexistenceErrStatus = 'NOT_ELIGIBLE') => {
      const errAccount = await WhatsAppAccount.findOneAndUpdate(
        { id: 'primary' },
        {
          $set: {
            status: 'ERROR',
            connectionStatus: 'ERROR',
            coexistenceStatus: coexistenceErrStatus,
            messagingActive: false,
            webhookSubscribed: false,
            lastError: humanError,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true, new: true }
      ).catch(() => existingAccount);

      return res.status(httpStatus).json({
        ok: false,
        status: 'ERROR',
        connectionStatus: 'ERROR',
        error: humanError,
        connection: buildSanitizedWhatsAppConnection({
          waAccount: errAccount,
          aiSettings,
          webhookUrl,
          webhookReady: sysCfg.whatsappVerifyTokenConfigured
        })
      });
    };

    if (sessionEvent === 'CANCEL') {
      return await failOnboarding(
        400,
        'Meta Embedded Signup was cancelled before completion. WhatsApp was not connected.'
      );
    }

    const version = sysCfg.whatsappApiVersion || 'v21.0';
    const appId = sysCfg.metaAppId;
    const configId = sysCfg.embeddedSignupConfigId;
    const appSecret = sysCfg.metaAppSecret;

    if (!appId || !configId) {
      return await failOnboarding(
        400,
        'Configuration Error: META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID are required in Admin Settings to complete Meta Embedded Signup.'
      );
    }

    if (!code || String(code).trim().length === 0) {
      return await failOnboarding(
        400,
        'Meta OAuth authorization code is missing. Simulated onboarding is disabled; please complete the official Meta Embedded Signup flow.'
      );
    }

    if (!appSecret || appSecret === 'replace_with_meta_app_secret_for_hmac_sha256') {
      return await failOnboarding(
        400,
        'Configuration Error: META_APP_SECRET is not configured in Admin Settings to exchange the Meta OAuth authorization code.'
      );
    }

    // 1. Exchange Meta OAuth authorization code for System User access token
    let resolvedAccessToken = '';
    try {
      const tokenParams = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code: String(code).trim()
      });
      if (redirectUri) {
        tokenParams.set('redirect_uri', String(redirectUri).trim());
      }
      const tokenRes = await fetch(
        `https://graph.facebook.com/${version}/oauth/access_token?${tokenParams.toString()}`
      );
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData?.access_token) {
        const oauthErr =
          tokenData?.error?.message ||
          `Meta OAuth code exchange failed with HTTP ${tokenRes.status}.`;
        return await failOnboarding(400, `Meta OAuth code exchange failed: ${oauthErr}`);
      }
      resolvedAccessToken = String(tokenData.access_token).trim();
    } catch (err) {
      return await failOnboarding(
        502,
        `Network error during Meta OAuth token exchange: ${err.message}`
      );
    }

    let resolvedWabaId = String(inputWabaId || '').trim();
    let resolvedPhoneId = String(inputPhoneNumberId || '').trim();
    let resolvedBusinessId = String(inputBusinessId || '').trim();

    // 2. If WABA ID was not returned in the Embedded Signup postMessage event, discover it via debug_token granular_scopes
    if (!resolvedWabaId) {
      try {
        const debugRes = await fetch(
          `https://graph.facebook.com/${version}/debug_token?input_token=${encodeURIComponent(
            resolvedAccessToken
          )}&access_token=${encodeURIComponent(resolvedAccessToken)}`
        );
        const debugData = await debugRes.json();
        const scopes = debugData?.data?.granular_scopes || [];
        const wabaScope = scopes.find(
          (s) =>
            s.scope === 'whatsapp_business_management' ||
            s.scope === 'whatsapp_business_messaging'
        );
        if (Array.isArray(wabaScope?.target_ids) && wabaScope.target_ids.length > 0) {
          resolvedWabaId = String(wabaScope.target_ids[0]).trim();
        }
      } catch {
        // continue to explicit check below
      }
    }

    if (!resolvedWabaId) {
      return await failOnboarding(
        400,
        'WABA lookup failed: Meta did not return a WhatsApp Business Account ID (waba_id) for this authorization.'
      );
    }

    // 3. Verify WABA and Business Portfolio via Meta Graph API
    let resolvedWabaName = '';
    let resolvedBusinessName = '';
    try {
      const wabaRes = await fetch(
        `https://graph.facebook.com/${version}/${resolvedWabaId}?fields=id,name,owner_business_info,on_behalf_of_business_info`,
        { headers: { Authorization: `Bearer ${resolvedAccessToken}` } }
      );
      const wabaData = await wabaRes.json();
      if (!wabaRes.ok || !wabaData?.id) {
        const wabaErr =
          wabaData?.error?.message || `WABA verification failed (HTTP ${wabaRes.status}).`;
        return await failOnboarding(400, `Meta WABA lookup failed: ${wabaErr}`);
      }
      resolvedWabaId = String(wabaData.id).trim();
      resolvedWabaName = String(wabaData.name || '').trim();
      resolvedBusinessId = String(
        wabaData.owner_business_info?.id ||
          wabaData.on_behalf_of_business_info?.id ||
          resolvedBusinessId ||
          ''
      ).trim();
      resolvedBusinessName = String(
        wabaData.owner_business_info?.name ||
          wabaData.on_behalf_of_business_info?.name ||
          resolvedWabaName ||
          ''
      ).trim();
    } catch (err) {
      return await failOnboarding(502, `Meta Graph API WABA lookup network error: ${err.message}`);
    }

    // 4. Discover / Verify Phone Number ID via Meta Graph API
    let resolvedDisplayPhone = '';
    let resolvedVerifiedName = '';
    let resolvedQualityRating = '';
    let resolvedCodeStatus = '';
    let resolvedPlatformType = '';
    let resolvedIsOnBizApp = false;

    try {
      if (!resolvedPhoneId) {
        const phonesRes = await fetch(
          `https://graph.facebook.com/${version}/${resolvedWabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,is_on_biz_app`,
          { headers: { Authorization: `Bearer ${resolvedAccessToken}` } }
        );
        const phonesData = await phonesRes.json();
        if (
          !phonesRes.ok ||
          !Array.isArray(phonesData?.data) ||
          phonesData.data.length === 0
        ) {
          const phonesErr =
            phonesData?.error?.message ||
            'No WhatsApp Business phone numbers were found under the selected WABA.';
          return await failOnboarding(400, `Meta Phone Number lookup failed: ${phonesErr}`);
        }
        const firstPhone = phonesData.data[0];
        resolvedPhoneId = String(firstPhone.id || '').trim();
      }

      const phoneRes = await fetch(
        `https://graph.facebook.com/${version}/${resolvedPhoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,is_on_biz_app`,
        { headers: { Authorization: `Bearer ${resolvedAccessToken}` } }
      );
      const phoneData = await phoneRes.json();
      if (!phoneRes.ok || !phoneData?.id) {
        const phoneErr =
          phoneData?.error?.message ||
          `Phone Number ID verification failed (HTTP ${phoneRes.status}).`;
        return await failOnboarding(400, `Meta Phone Number verification failed: ${phoneErr}`);
      }

      resolvedPhoneId = String(phoneData.id).trim();
      resolvedDisplayPhone = String(phoneData.display_phone_number || '').trim();
      resolvedVerifiedName = String(phoneData.verified_name || resolvedBusinessName || '').trim();
      resolvedQualityRating = String(phoneData.quality_rating || '').trim();
      resolvedCodeStatus = String(phoneData.code_verification_status || '').trim();
      resolvedPlatformType = String(phoneData.platform_type || '').trim();
      resolvedIsOnBizApp = Boolean(phoneData.is_on_biz_app);
    } catch (err) {
      return await failOnboarding(
        502,
        `Meta Graph API Phone Number verification error: ${err.message}`
      );
    }

    // 5. Subscribe WABA to Webhook (POST /{WABA-ID}/subscribed_apps) AND Verify (GET /{WABA-ID}/subscribed_apps)
    let webhookSubscribed = false;
    try {
      const subPostRes = await fetch(
        `https://graph.facebook.com/${version}/${resolvedWabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resolvedAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const subPostData = await subPostRes.json();
      if (!subPostRes.ok || !subPostData?.success) {
        const subErr =
          subPostData?.error?.message ||
          `Failed to subscribe WABA to webhook (HTTP ${subPostRes.status}).`;
        return await failOnboarding(400, `WABA webhook subscription failed: ${subErr}`);
      }

      const subGetRes = await fetch(
        `https://graph.facebook.com/${version}/${resolvedWabaId}/subscribed_apps`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${resolvedAccessToken}` }
        }
      );
      const subGetData = await subGetRes.json();
      if (
        !subGetRes.ok ||
        !Array.isArray(subGetData?.data) ||
        subGetData.data.length === 0
      ) {
        const verifySubErr =
          subGetData?.error?.message ||
          'Meta GET /subscribed_apps did not confirm an active app subscription on this WABA.';
        return await failOnboarding(
          400,
          `WABA webhook subscription verification failed: ${verifySubErr}`
        );
      }
      webhookSubscribed = true;
    } catch (err) {
      return await failOnboarding(
        502,
        `WABA webhook subscription network error: ${err.message}`
      );
    }

    // 6. Coexistence vs Standard Cloud API Initialization
    const isCoexistenceOnboarding =
      sessionEvent === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' || resolvedIsOnBizApp === true;

    let coexistenceStatus = 'NOT_ELIGIBLE';
    let coexistenceStatusNote = '';

    if (isCoexistenceOnboarding) {
      // CRITICAL COEXISTENCE RULE:
      // DO NOT call POST /{phone_number_id}/register on a WhatsApp Business App Coexistence number!
      // Instead, trigger smb_app_data state sync (contacts) and history sync.
      try {
        const stateSyncRes = await fetch(
          `https://graph.facebook.com/${version}/${resolvedPhoneId}/smb_app_data`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resolvedAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              sync_type: 'smb_app_state_sync'
            })
          }
        );
        const stateSyncData = await stateSyncRes.json();
        if (!stateSyncRes.ok) {
          const syncErr =
            stateSyncData?.error?.message ||
            `Coexistence smb_app_state_sync failed (HTTP ${stateSyncRes.status}).`;
          return await failOnboarding(
            400,
            `Coexistence contacts/state initialization failed: ${syncErr}`,
            'ERROR'
          );
        }

        const historySyncRes = await fetch(
          `https://graph.facebook.com/${version}/${resolvedPhoneId}/smb_app_data`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resolvedAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              sync_type: 'history'
            })
          }
        );
        const historySyncData = await historySyncRes.json();
        if (!historySyncRes.ok) {
          const histErr =
            historySyncData?.error?.message ||
            `Coexistence history sync failed (HTTP ${historySyncRes.status}).`;
          return await failOnboarding(
            400,
            `Coexistence history sync initialization failed: ${histErr}`,
            'ERROR'
          );
        }

        coexistenceStatus = 'CONNECTED';
        coexistenceStatusNote =
          'WhatsApp Business App + Cloud API Coexistence is verified and active. Mobile app state & history sync initialized.';
      } catch (err) {
        return await failOnboarding(
          502,
          `Coexistence smb_app_data initialization network error: ${err.message}`,
          'ERROR'
        );
      }
    } else {
      // Standard Cloud API onboarding (FINISH)
      // Only call /register if a 6-digit PIN was provided and number is not on the mobile Business App
      if (pin && String(pin).trim().length === 6) {
        try {
          const regRes = await fetch(
            `https://graph.facebook.com/${version}/${resolvedPhoneId}/register`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resolvedAccessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                pin: String(pin).trim()
              })
            }
          );
          const regData = await regRes.json();
          if (!regRes.ok) {
            return await failOnboarding(
              400,
              `Cloud API phone registration failed: ${
                regData?.error?.message || `HTTP ${regRes.status}`
              }`
            );
          }
        } catch (err) {
          return await failOnboarding(
            502,
            `Cloud API phone registration network error: ${err.message}`
          );
        }
      }

      coexistenceStatus = 'NOT_ELIGIBLE';
      coexistenceStatusNote =
        'Connected via standard WhatsApp Cloud API. Coexistence is not active for this number.';
    }

    // 7. Prevent duplicate WhatsAppAccount records & persist verified connection in MongoDB
    await WhatsAppAccount.deleteMany({
      id: { $ne: 'primary' },
      $or: [{ phoneNumberId: resolvedPhoneId }, { wabaId: resolvedWabaId }]
    }).catch(() => {});

    const nowIso = new Date().toISOString();
    const updatedAccount = await WhatsAppAccount.findOneAndUpdate(
      { id: 'primary' },
      {
        $set: {
          connectedByUserId: req.authUser?.id || '',
          connectedBy: req.authUser?.email || req.authUser?.name || 'Admin',
          status: 'CONNECTED',
          connectionStatus: 'CONNECTED',
          onboardingMode: isCoexistenceOnboarding ? 'COEXISTENCE' : onboardingMode,
          coexistenceStatus,
          coexistenceEligible: coexistenceStatus === 'CONNECTED',
          coexistenceStatusNote,
          businessPortfolioId: resolvedBusinessId,
          businessId: resolvedBusinessId,
          businessName: resolvedBusinessName,
          wabaId: resolvedWabaId,
          wabaName: resolvedWabaName,
          phoneNumberId: resolvedPhoneId,
          displayPhoneNumber: resolvedDisplayPhone,
          verifiedName: resolvedVerifiedName,
          qualityRating: resolvedQualityRating,
          codeVerificationStatus: resolvedCodeStatus,
          platformType: resolvedPlatformType,
          isOnBizApp: resolvedIsOnBizApp,
          accessToken: encryptSecret(resolvedAccessToken),
          tokenType: 'BEARER',
          webhookSubscribed: true,
          messagingActive: true,
          connectedAt: nowIso,
          updatedAt: nowIso,
          lastVerifiedAt: nowIso,
          lastError: ''
        }
      },
      { upsert: true, new: true }
    );

    await Setting.findOneAndUpdate(
      { type: 'whatsappSettings' },
      {
        $set: {
          'data.isConnected': true,
          'data.phoneNumberId': resolvedPhoneId,
          'data.businessAccountId': resolvedWabaId,
          'data.displayPhoneNumber': resolvedDisplayPhone,
          'data.businessName': resolvedBusinessName,
          'data.wabaName': resolvedWabaName,
          'data.lastWebhookAt': nowIso
        }
      },
      { upsert: true }
    );

    await Setting.findOneAndUpdate(
      { type: 'aiSettings' },
      {
        $set: {
          'data.aiEnabled': true,
          'data.autoReplyEnabled': true
        }
      },
      { upsert: true }
    );

    const updatedAiDoc = await Setting.findOne({ type: 'aiSettings' });
    const sanitized = buildSanitizedWhatsAppConnection({
      waAccount: updatedAccount,
      aiSettings: updatedAiDoc?.data || { ...aiSettings, aiEnabled: true, autoReplyEnabled: true },
      webhookUrl,
      webhookReady: sysCfg.whatsappVerifyTokenConfigured
    });

    res.json({
      ok: true,
      status: 'CONNECTED',
      connectionStatus: 'CONNECTED',
      graphVerified: true,
      webhookSubscribed: true,
      coexistenceStatus,
      connection: sanitized
    });
  } catch (err) {
    res.status(500).json({ ok: false, status: 'ERROR', error: err.message });
  }
});

// Disconnect WhatsApp account from PulseFlow CRM (Protected: Admin only)
// IMPORTANT: Does NOT deregister or deactivate the WhatsApp Business mobile app number on Meta.
app.post('/api/whatsapp/disconnect', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sysCfg = await getRuntimeSystemConfig(req);
    const aiSettingDoc = await Setting.findOne({ type: 'aiSettings' });
    const nowIso = new Date().toISOString();

    const updatedAccount = await WhatsAppAccount.findOneAndUpdate(
      { id: 'primary' },
      {
        $set: {
          status: 'NOT_CONNECTED',
          connectionStatus: 'NOT_CONNECTED',
          coexistenceStatus: 'NOT_ELIGIBLE',
          coexistenceEligible: false,
          coexistenceStatusNote: '',
          messagingActive: false,
          webhookSubscribed: false,
          accessToken: '',
          lastError: '',
          updatedAt: nowIso
        }
      },
      { upsert: true, new: true }
    );

    await Setting.findOneAndUpdate(
      { type: 'whatsappSettings' },
      {
        $set: {
          'data.isConnected': false,
          'data.phoneNumberId': '',
          'data.businessAccountId': '',
          'data.displayPhoneNumber': '',
          'data.lastWebhookAt': 'Disconnected'
        }
      }
    );

    const webhookUrl = sysCfg.webhookUrl;

    res.json({
      ok: true,
      status: 'NOT_CONNECTED',
      connectionStatus: 'NOT_CONNECTED',
      connection: buildSanitizedWhatsAppConnection({
        waAccount: updatedAccount,
        aiSettings: aiSettingDoc?.data || INITIAL_AI_SETTINGS,
        webhookUrl,
        webhookReady: sysCfg.whatsappVerifyTokenConfigured
      })
    });
  } catch (err) {
    res.status(500).json({ ok: false, status: 'ERROR', error: err.message });
  }
});

app.get('/api/whatsapp/status', async (req, res) => {
  const sysCfg = await getRuntimeSystemConfig(req);
  const creds = await getActiveWhatsAppCredentials();
  const cleanToken = creds.token;
  const phoneId = creds.phoneNumberId;
  const wabaId = creds.wabaId;
  const version = creds.version;
  const waAccount = creds.waAccount;

  const aiSettingDoc = await Setting.findOne({ type: 'aiSettings' });
  const aiSettings = aiSettingDoc?.data || INITIAL_AI_SETTINGS;

  const verifyTokenConfigured = sysCfg.whatsappVerifyTokenConfigured;
  const appSecretConfigured = sysCfg.metaAppSecretConfigured;
  const webhookUrl = sysCfg.webhookUrl;

  if (!creds.canSend || !cleanToken || !phoneId || !wabaId) {
    const connection = buildSanitizedWhatsAppConnection({
      waAccount,
      aiSettings,
      webhookUrl,
      webhookReady: verifyTokenConfigured
    });
    return res.json({
      webhookReady: verifyTokenConfigured,
      webhookUrl,
      verifyTokenConfigured,
      appSecretConfigured,
      cloudApiConnected: false,
      phoneNumberId: '',
      businessAccountId: '',
      apiVersion: version,
      error:
        waAccount?.lastError ||
        'WhatsApp is not connected yet. Connect your WhatsApp Business Account via Meta Embedded Signup.',
      connection
    });
  }

  try {
    const [phoneRes, subGetRes] = await Promise.all([
      fetch(
        `https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,is_on_biz_app`,
        { headers: { Authorization: `Bearer ${cleanToken}` } }
      ),
      fetch(`https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      })
    ]);

    const data = await phoneRes.json();
    const subData = await subGetRes.json();
    const verifiedWebhookSubscribed = Boolean(
      subGetRes.ok && Array.isArray(subData?.data) && subData.data.length > 0
    );

    if (!phoneRes.ok || !verifiedWebhookSubscribed) {
      const errMessage = !phoneRes.ok
        ? data?.error?.message || `Meta Graph API HTTP ${phoneRes.status}`
        : 'WABA is not actively subscribed to the app webhook (GET /subscribed_apps returned empty).';

      const errAccount = await WhatsAppAccount.findOneAndUpdate(
        { id: 'primary' },
        {
          $set: {
            status: 'ERROR',
            connectionStatus: 'ERROR',
            messagingActive: false,
            webhookSubscribed: verifiedWebhookSubscribed,
            lastError: errMessage,
            updatedAt: new Date().toISOString()
          }
        },
        { new: true }
      ).catch(() => waAccount);

      const connection = buildSanitizedWhatsAppConnection({
        waAccount: errAccount,
        aiSettings,
        webhookUrl,
        webhookReady: verifyTokenConfigured
      });

      return res.json({
        webhookReady: verifyTokenConfigured,
        webhookUrl,
        verifyTokenConfigured,
        appSecretConfigured,
        cloudApiConnected: false,
        phoneNumberId: '',
        businessAccountId: '',
        apiVersion: version,
        error: errMessage,
        errorCode: data?.error?.code,
        connection
      });
    }

    const nowIso = new Date().toISOString();
    const isOnBizApp = Boolean(data.is_on_biz_app);
    const coexistenceStatus =
      waAccount?.coexistenceStatus === 'CONNECTED' || isOnBizApp ? 'CONNECTED' : 'NOT_ELIGIBLE';

    const updatedAccount = await WhatsAppAccount.findOneAndUpdate(
      { id: 'primary' },
      {
        $set: {
          status: 'CONNECTED',
          connectionStatus: 'CONNECTED',
          phoneNumberId: data.id || phoneId,
          wabaId,
          displayPhoneNumber: data.display_phone_number || waAccount?.displayPhoneNumber || '',
          verifiedName: data.verified_name || waAccount?.verifiedName || '',
          qualityRating: data.quality_rating || waAccount?.qualityRating || '',
          platformType: data.platform_type || '',
          isOnBizApp,
          coexistenceStatus,
          coexistenceEligible: coexistenceStatus === 'CONNECTED',
          messagingActive: true,
          webhookSubscribed: true,
          lastVerifiedAt: nowIso,
          updatedAt: nowIso,
          lastError: ''
        }
      },
      { new: true }
    ).catch(() => waAccount);

    const connection = buildSanitizedWhatsAppConnection({
      waAccount: updatedAccount,
      aiSettings,
      webhookUrl,
      webhookReady: verifyTokenConfigured
    });

    return res.json({
      webhookReady: verifyTokenConfigured,
      webhookUrl,
      verifyTokenConfigured,
      appSecretConfigured,
      cloudApiConnected: true,
      phoneNumberId: maskIdentifier(data.id || phoneId),
      businessAccountId: maskIdentifier(wabaId),
      apiVersion: version,
      displayPhoneNumber: maskPhoneNumber(data.display_phone_number || ''),
      verifiedName: data.verified_name || '',
      qualityRating: data.quality_rating || '',
      connection
    });
  } catch (err) {
    const connection = buildSanitizedWhatsAppConnection({
      waAccount,
      aiSettings,
      webhookUrl,
      webhookReady: verifyTokenConfigured
    });
    return res.json({
      webhookReady: verifyTokenConfigured,
      webhookUrl,
      verifyTokenConfigured,
      appSecretConfigured,
      cloudApiConnected: false,
      phoneNumberId: '',
      businessAccountId: '',
      apiVersion: version,
      error: err.message,
      connection
    });
  }
});

// Diagnostic & direct test-send endpoint for testing outbound WhatsApp Cloud API (Protected: Admin only, no hardcoded recipient)
app.post('/api/whatsapp/test-send', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { to, message } = req.body || {};
    const recipient = String(to || '').trim();
    if (!recipient) {
      return res.status(400).json({
        ok: false,
        error: 'Recipient phone number ("to") is required. Hardcoded test numbers are disabled.'
      });
    }
    const text = String(message || 'Test outbound message from PulseFlow CRM').trim();

    const result = await sendWhatsAppCloudMessage(recipient, text);
    res.status(result.sent ? 200 : 400).json({
      ok: result.sent,
      statusCode: result.statusCode,
      whatsappMessageId: result.whatsappMessageId,
      error: result.error,
      errorCode: result.errorCode,
      errorType: result.errorType,
      diagnosticHint: result.diagnosticHint
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================================
// REST API ROUTES FOR MONGODB CRM OPERATIONS
// ============================================================================

// Compute dynamic strategic findings from real database leads & conversations
function computeDynamicFindings(leads, contacts, conversations) {
  const findings = [];
  const hotLeads = leads.filter((l) => l.leadType === 'HOT');
  const handoffConvs = conversations.filter(
    (c) => c.humanAttentionRecommended || c.needsHumanAttention
  );

  if (hotLeads.length > 0) {
    const hotValue = hotLeads.reduce((sum, l) => sum + (l.estimatedValueInr || 0), 0);
    const valueStr =
      hotValue >= 100000
        ? `₹${(hotValue / 100000).toFixed(2)}L`
        : `₹${hotValue.toLocaleString('en-IN')}`;
    findings.push({
      id: 'sf-dynamic-hot',
      category: 'REVENUE_SIGNAL',
      title: `${hotLeads.length} Hot Lead${hotLeads.length > 1 ? 's' : ''} (${valueStr}) Ready for Closing`,
      metricBadge: `${hotLeads.length} HOT DEALS`,
      findingSummary: `Your database currently has ${hotLeads.length} high-intent lead(s) scored 81+ based on confirmed requirements and budget.`,
      recommendation: 'Follow up with your Hot Leads and share formal proposals to close deals.',
      actionLabel: 'Inspect Hot Leads',
      actionLink: '/leads',
      impactLevel: 'HIGH'
    });
  }

  if (handoffConvs.length > 0) {
    findings.push({
      id: 'sf-dynamic-handoff',
      category: 'CONVERSION_BOTTLENECK',
      title: `${handoffConvs.length} WhatsApp Chat${handoffConvs.length > 1 ? 's' : ''} Recommended for Human Review`,
      metricBadge: 'HUMAN ATTENTION RECOMMENDED',
      findingSummary: `AI flagged ${handoffConvs.length} conversation(s) that may benefit from human review while AI continues replying automatically.`,
      recommendation: 'Open WhatsApp Inbox and reply directly to resolve customer questions.',
      actionLabel: 'Open WhatsApp Inbox',
      actionLink: '/inbox',
      impactLevel: 'HIGH'
    });
  }

  return findings;
}

// 1. Bootstrap all CRM state from MongoDB
app.get('/api/bootstrap', async (_req, res) => {
  try {
    await connectDB();

    const [
      teamDocs,
      contactDocs,
      leadDocs,
      convDocs,
      msgDocs,
      followUpDocs,
      kbDocs,
      gapDocs,
      settingDocs,
      notifDocs
    ] = await Promise.all([
      TeamMember.find({}).sort({ _id: 1 }),
      Contact.find({}).sort({ _id: -1 }),
      Lead.find({}).sort({ leadScore: -1, _id: -1 }),
      Conversation.find({}).sort({ _id: -1 }),
      Message.find({}).sort({ createdAt: 1, _id: 1 }),
      FollowUp.find({}).sort({ date: 1, time: 1 }),
      KnowledgeBase.find({}).sort({ _id: -1 }),
      KnowledgeGap.find({}).sort({ _id: -1 }),
      Setting.find({}),
      Notification.find({}).sort({ createdAt: -1, _id: -1 })
    ]);

    const teamMembers = cleanList(teamDocs);
    const contacts = cleanList(contactDocs);
    const leads = cleanList(leadDocs);
    const conversations = cleanList(convDocs);
    const messages = cleanList(msgDocs);
    const followUps = cleanList(followUpDocs);
    const knowledgeBase = cleanList(kbDocs);
    const knowledgeGaps = cleanList(gapDocs);
    const notifications = cleanList(notifDocs);

    const messagesByConv = {};
    for (const c of conversations) {
      messagesByConv[c.id] = [];
    }
    for (const m of messages) {
      const cid = m.conversationId || m.convId;
      if (cid) {
        if (!messagesByConv[cid]) messagesByConv[cid] = [];
        messagesByConv[cid].push(m);
      }
    }

    const sysCfg = await getRuntimeSystemConfig(_req);
    const sanitizedSys = buildSanitizedSystemConfig(sysCfg);

    const rawAiSettings =
      settingDocs.find((s) => s.type === 'aiSettings')?.data || INITIAL_AI_SETTINGS;
    const rawWhatsappSettings =
      settingDocs.find((s) => s.type === 'whatsappSettings')?.data || INITIAL_WHATSAPP_SETTINGS;
    const companySettings =
      settingDocs.find((s) => s.type === 'companySettings')?.data || INITIAL_COMPANY_SETTINGS;

    const {
      geminiApiKey: _g,
      openaiApiKey: _o,
      apiKey: _a,
      ...cleanAiSettings
    } = rawAiSettings;

    const aiSettings = {
      ...cleanAiSettings,
      provider: sanitizedSys.aiProvider || cleanAiSettings.provider || 'GEMINI',
      model:
        (sanitizedSys.aiProvider || cleanAiSettings.provider) === 'OPENAI'
          ? sanitizedSys.openaiModel
          : sanitizedSys.geminiModel,
      geminiModel: sanitizedSys.geminiModel,
      openaiModel: sanitizedSys.openaiModel,
      geminiApiKeyConfigured: sanitizedSys.geminiApiKeyConfigured,
      openaiApiKeyConfigured: sanitizedSys.openaiApiKeyConfigured,
      aiProviderConfigured: sanitizedSys.aiProviderConfigured
    };

    const {
      verifyToken: _vt,
      n8nEnabled: _n1,
      n8nWebhookUrl: _n2,
      n8nForwardingEnabled: _n3,
      accessToken: _at,
      metaAppSecret: _ms,
      ...cleanWaSettings
    } = rawWhatsappSettings;

    const whatsappSettings = {
      ...cleanWaSettings,
      phoneNumberId: cleanWaSettings.isConnected ? maskIdentifier(cleanWaSettings.phoneNumberId) : '',
      businessAccountId: cleanWaSettings.isConnected
        ? maskIdentifier(cleanWaSettings.businessAccountId)
        : '',
      displayPhoneNumber: cleanWaSettings.isConnected
        ? maskPhoneNumber(cleanWaSettings.displayPhoneNumber)
        : '',
      webhookUrl: sanitizedSys.webhookUrl,
      verifyTokenConfigured: sanitizedSys.whatsappVerifyTokenConfigured,
      appSecretConfigured: sanitizedSys.metaAppSecretConfigured,
      metaConfigurationPresent: sanitizedSys.metaConfigurationPresent
    };

    const strategicFindings = computeDynamicFindings(leads, contacts, conversations);

    res.json({
      teamMembers,
      contacts,
      leads,
      conversations,
      messagesByConv,
      followUps,
      knowledgeBase,
      knowledgeGaps,
      strategicFindings,
      aiSettings,
      whatsappSettings,
      companySettings,
      notifications
    });
  } catch (err) {
    console.error('[api/bootstrap] Error loading data from MongoDB:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 1B. Authentication & Session Routes (Email + Password)
app.post('/api/auth/login', async (req, res) => {
  try {
    await connectDB();
    const emailRaw = String(req.body?.email || '').trim().toLowerCase();
    const passwordRaw = String(req.body?.password || '');

    if (!emailRaw || !passwordRaw) {
      return res.status(400).json({ error: 'Work email and password are required.' });
    }

    const allMembers = await TeamMember.find({});
    const member = allMembers.find(
      (m) => String(m.email || '').trim().toLowerCase() === emailRaw
    );

    if (!member) {
      return res.status(401).json({ error: 'Invalid work email or password.' });
    }

    if (member.isActive === false) {
      return res.status(403).json({
        error: 'This team account is currently deactivated. Contact your workspace Admin.'
      });
    }

    let validPassword = false;
    if (member.passwordHash && member.passwordSalt) {
      validPassword = verifyPassword(passwordRaw, member.passwordHash, member.passwordSalt);
    } else {
      // Legacy fallback for unseeded records: accept default PulseFlow@123 and hash it
      if (passwordRaw === 'PulseFlow@123') {
        validPassword = true;
        const { passwordHash, passwordSalt } = hashPassword(passwordRaw);
        await TeamMember.findOneAndUpdate(
          { id: member.id },
          { $set: { passwordHash, passwordSalt } }
        );
      }
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid work email or password.' });
    }

    const nowLoginStr = new Date().toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const updatedMember = await TeamMember.findOneAndUpdate(
      { id: member.id },
      { $set: { lastLoginAt: nowLoginStr } },
      { new: true }
    );

    const cleanUser = cleanDoc(updatedMember || member);
    const actualRole = cleanUser.role === 'ADMIN' ? 'ADMIN' : 'AGENT';
    cleanUser.role = actualRole;
    const token = signJwtToken({
      id: cleanUser.id,
      email: cleanUser.email,
      role: actualRole
    });

    return res.json({
      ok: true,
      token,
      user: cleanUser
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    await connectDB();
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    const roleRaw = req.body?.role ? String(req.body.role).trim().toUpperCase() : 'AGENT';

    if (!VALID_ROLES.includes(roleRaw)) {
      return res.status(400).json({
        error: 'Invalid role specified. Allowed roles are ADMIN and AGENT only.'
      });
    }

    const caller = await resolveAuthenticatedUser(req);
    const allMembers = await TeamMember.find({});
    const hasAdmin = allMembers.some((m) => m.role === 'ADMIN');

    // Only an existing ADMIN (or first-time bootstrap when no ADMIN exists) can create an ADMIN account
    if (roleRaw === 'ADMIN' && hasAdmin && caller?.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Only an existing ADMIN can create another ADMIN account.'
      });
    }

    const role = roleRaw === 'ADMIN' && (!hasAdmin || caller?.role === 'ADMIN') ? 'ADMIN' : 'AGENT';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Full name, work email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = allMembers.find(
      (m) => String(m.email || '').trim().toLowerCase() === email
    );
    if (existing) {
      return res.status(409).json({ error: 'A team member with this email already exists.' });
    }

    const { passwordHash, passwordSalt } = hashPassword(password);
    const nowLoginStr = new Date().toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const created = await TeamMember.create({
      id: `usr-${Date.now()}`,
      name,
      email,
      phone,
      role,
      passwordHash,
      passwordSalt,
      isActive: true,
      assignedLeadsCount: 0,
      activeChatsCount: 0,
      lastLoginAt: nowLoginStr,
      conversionRate: 0,
      avgResponseTime: '—'
    });

    const cleanUser = cleanDoc(created);
    const token = signJwtToken({
      id: cleanUser.id,
      email: cleanUser.email,
      role: cleanUser.role
    });

    return res.status(201).json({
      ok: true,
      token,
      user: cleanUser
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json({ ok: true, user: req.authUser });
});

app.patch('/api/auth/profile', requireAdmin, async (req, res) => {
  try {
    const targetId = req.authUser.id;
    const updateFields = {};

    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      updateFields.name = req.body.name.trim();
    }
    if (typeof req.body?.email === 'string' && req.body.email.trim()) {
      const normalizedEmail = req.body.email.trim().toLowerCase();
      const allMembers = await TeamMember.find({});
      const duplicate = allMembers.find(
        (m) => m.id !== targetId && String(m.email || '').trim().toLowerCase() === normalizedEmail
      );
      if (duplicate) {
        return res.status(409).json({ error: 'Another team member is already using this email.' });
      }
      updateFields.email = normalizedEmail;
    }
    if (typeof req.body?.phone === 'string') {
      updateFields.phone = req.body.phone.trim();
    }

    const updated = await TeamMember.findOneAndUpdate(
      { id: targetId },
      { $set: updateFields },
      { new: true }
    );
    return res.json({ ok: true, user: cleanDoc(updated) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  try {
    const caller = req.authUser;
    const { userId, email, currentPassword, newPassword } = req.body || {};

    if (!newPassword || String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ error: 'New password must be at least 6 characters long.' });
    }

    let member = null;
    if (userId) {
      member = await TeamMember.findOne({ id: userId });
    } else if (email) {
      const allMembers = await TeamMember.find({});
      member = allMembers.find(
        (m) => String(m.email || '').trim().toLowerCase() === String(email).trim().toLowerCase()
      );
    } else {
      member = await TeamMember.findOne({ id: caller.id });
    }

    if (!member) {
      return res.status(404).json({ error: 'Team member account not found.' });
    }

    // When changing own password and currentPassword is provided, verify it
    if (member.id === caller.id && currentPassword) {
      const isCurrentValid =
        member.passwordHash && member.passwordSalt
          ? verifyPassword(currentPassword, member.passwordHash, member.passwordSalt)
          : currentPassword === 'PulseFlow@123';

      if (!isCurrentValid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const { passwordHash, passwordSalt } = hashPassword(newPassword);
    const updated = await TeamMember.findOneAndUpdate(
      { id: member.id },
      { $set: { passwordHash, passwordSalt } },
      { new: true }
    );

    return res.json({
      ok: true,
      user: cleanDoc(updated)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Team Members CRUD (Strictly ADMIN-only)
app.post('/api/team', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const roleRaw = req.body?.role ? String(req.body.role).trim().toUpperCase() : 'AGENT';

    if (!VALID_ROLES.includes(roleRaw)) {
      return res.status(400).json({
        error: 'Invalid role. Allowed roles are ADMIN and AGENT only.'
      });
    }
    const role = roleRaw;
    const rawPassword = String(req.body?.password || 'PulseFlow@123');

    if (!name || !email) {
      return res.status(400).json({ error: 'Full name and work email are required.' });
    }
    if (rawPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const allMembers = await TeamMember.find({});
    const duplicate = allMembers.find(
      (m) => String(m.email || '').trim().toLowerCase() === email
    );
    if (duplicate) {
      return res.status(409).json({ error: 'A team member with this work email already exists.' });
    }

    const { passwordHash, passwordSalt } = hashPassword(rawPassword);

    const payload = {
      id: req.body.id || `usr-${Date.now()}`,
      name,
      email,
      role,
      phone,
      passwordHash,
      passwordSalt,
      isActive: req.body.isActive ?? true,
      assignedLeadsCount: 0,
      activeChatsCount: 0,
      lastLoginAt: 'Never',
      conversionRate: 0,
      avgResponseTime: '—'
    };
    const created = await TeamMember.create(payload);
    res.status(201).json(cleanDoc(created));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/team/:id', requireAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const existing = await TeamMember.findOne({ id: targetId });
    if (!existing) {
      return res.status(404).json({ error: 'Team member not found.' });
    }

    if (
      req.body.name !== undefined ||
      req.body.email !== undefined ||
      req.body.phone !== undefined ||
      req.body.role !== undefined
    ) {
      return res.status(403).json({
        error: 'Editing existing team member details is disabled. Delete and recreate the account if changes are required.'
      });
    }

    const updateFields = {};

    if (typeof req.body.isActive === 'boolean') {
      updateFields.isActive = req.body.isActive;
    }

    const newPass = req.body.newPassword || req.body.password;
    if (typeof newPass === 'string' && newPass.trim().length > 0) {
      if (newPass.trim().length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      const { passwordHash, passwordSalt } = hashPassword(newPass.trim());
      updateFields.passwordHash = passwordHash;
      updateFields.passwordSalt = passwordSalt;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid status or password update fields provided.' });
    }

    const updated = await TeamMember.findOneAndUpdate(
      { id: targetId },
      { $set: updateFields },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/team/:id', requireAdmin, async (req, res) => {
  try {
    await TeamMember.findOneAndDelete({ id: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Contacts CRUD
app.post('/api/contacts', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const contactId = req.body.id || `cnt-${Date.now()}`;

    const createdContact = await Contact.create({
      id: contactId,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email || '',
      company: req.body.company || '',
      roleTitle: req.body.roleTitle || '',
      location: req.body.location || '',
      preferredLanguage: req.body.preferredLanguage || 'English',
      bestTimeToContact: req.body.bestTimeToContact || 'Anytime',
      source: req.body.source || 'WhatsApp Inbound',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      notes: [],
      createdAt: todayStr,
      lastInteractionAt: 'Just now',
      totalConversations: 1,
      totalMessages: 0
    });

    const leadId = `ld-${Date.now()}`;
    const convId = `conv-${Date.now()}`;

    let createdLead = null;
    if (req.body.createLead !== false) {
      createdLead = await Lead.create({
        id: leadId,
        contactId: createdContact.id,
        conversationId: req.body.createConversation !== false ? convId : '',
        leadStatus: 'NEW',
        leadType: 'WARM',
        leadScore: 50,
        scoreBreakdown: {
          budgetReadiness: 12,
          needSpecificity: 12,
          timelineUrgency: 10,
          decisionAuthority: 8,
          engagementDepth: 8
        },
        interestedService: (req.body.tags && req.body.tags[0]) || 'General Inquiry',
        budget: 'Not disclosed',
        estimatedValueInr: 0,
        timeline: 'Not specified',
        requirements: [],
        buyingSignals: ['New contact added to CRM'],
        detectedObjections: [],
        recommendedNextAction: 'Review customer requirements and send initial response.',
        source: createdContact.source || 'WhatsApp Inbound',
        assignedAgentId: req.body.assignedAgentId || 'admin-1',
        aiSummary: `New contact ${createdContact.name} created.`,
        purchaseIntent: false,
        lastInteractionAt: 'Just now',
        createdAt: todayStr,
        updatedAt: todayStr,
        notes: []
      });
    }

    let createdConversation = null;
    if (req.body.createConversation !== false) {
      createdConversation = await Conversation.create({
        id: convId,
        contactId: createdContact.id,
        leadId: createdLead ? createdLead.id : '',
        assignedAgentId: req.body.assignedAgentId || 'admin-1',
        status: 'OPEN',
        aiEnabled: true,
        humanTakeoverActive: false,
        humanAttentionRecommended: false,
        needsHumanAttention: false,
        unreadCount: 0,
        lastMessage: 'Contact added to CRM — ready to chat on WhatsApp',
        lastMessageTime: nowStr,
        language: createdContact.preferredLanguage || 'English',
        keyFinding: `Contact added (${createdContact.company || createdContact.phone})`
      });
    }

    res.status(201).json({
      contact: cleanDoc(createdContact),
      conversation: cleanDoc(createdConversation),
      lead: cleanDoc(createdLead)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/contacts/:id', async (req, res) => {
  try {
    const updated = await Contact.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const contactId = req.params.id;
    const convs = await Conversation.find({ contactId });
    const convIds = convs.map((c) => c.id);
    await Promise.all([
      Contact.findOneAndDelete({ id: contactId }),
      Lead.deleteMany({ contactId }),
      Conversation.deleteMany({ contactId }),
      Message.deleteMany({ conversationId: { $in: convIds } }),
      FollowUp.deleteMany({ contactId })
    ]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/:id/notes', async (req, res) => {
  try {
    const note = {
      id: `cn-${Date.now()}`,
      content: req.body.content,
      authorName: req.body.authorName || 'Admin',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = await Contact.findOneAndUpdate(
      { id: req.params.id },
      { $push: { notes: { $each: [note], $position: 0 } } },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Leads CRUD & Real-Time Hot Lead Alerts
app.get('/api/leads/hot-alerts', async (req, res) => {
  try {
    await connectDB();
    const userId = String(req.query.userId || 'admin-1');
    const [leadDocs, contactDocs, convDocs] = await Promise.all([
      Lead.find({}).sort({ leadScore: -1, _id: -1 }),
      Contact.find({}),
      Conversation.find({})
    ]);

    const leads = cleanList(leadDocs);
    const contacts = cleanList(contactDocs);
    const conversations = cleanList(convDocs);

    const unacknowledgedHotLeads = leads.filter((lead) => {
      const isHot = lead.leadType === 'HOT' || Number(lead.leadScore) >= 81;
      if (!isHot) return false;
      const transitionAt = Number(lead.lastHotTransitionAt || 0);
      if (transitionAt <= 0) return false;
      const userAckAt = Number(lead.hotLeadAcknowledgedBy?.[userId] || 0);
      const globalAckAt = Number(lead.hotLeadAcknowledgedAt || 0);
      const ackAt = Math.max(userAckAt, globalAckAt);
      return ackAt < transitionAt;
    });

    const alerts = unacknowledgedHotLeads.map((lead) => {
      const contact = contacts.find((c) => c.id === lead.contactId);
      const conv = conversations.find(
        (c) =>
          (lead.conversationId && c.id === lead.conversationId) ||
          c.leadId === lead.id ||
          (lead.contactId && c.contactId === lead.contactId)
      );
      return {
        leadId: lead.id,
        contactId: lead.contactId,
        conversationId: conv?.id || lead.conversationId || '',
        customerName: contact?.name || 'WhatsApp Customer',
        customerPhone: contact?.phone || '',
        company: contact?.company || '',
        interestedService: lead.interestedService || 'General Inquiry',
        leadScore: Number(lead.leadScore ?? 85),
        leadType: 'HOT',
        leadStatus: lead.leadStatus || 'NEW',
        budget: lead.budget || 'Not disclosed',
        recommendedNextAction:
          lead.recommendedNextAction || 'Handover this lead to a human sales representative.',
        lastHotTransitionAt: Number(lead.lastHotTransitionAt || 0),
        hotLeadNotifiedAt: Number(lead.hotLeadNotifiedAt || lead.lastHotTransitionAt || 0)
      };
    });

    res.json({
      count: alerts.length,
      alerts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/hot-alerts/acknowledge', async (req, res) => {
  try {
    await connectDB();
    const userId = String(req.body?.userId || 'admin-1');
    const leadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds : [];
    const acknowledgeAll = Boolean(req.body?.acknowledgeAll);
    const nowMs = Date.now();

    const allLeads = await Lead.find({});
    const targetLeads = allLeads.filter((l) => {
      if (acknowledgeAll) {
        const isHot = l.leadType === 'HOT' || Number(l.leadScore) >= 81;
        return isHot && Number(l.lastHotTransitionAt || 0) > 0;
      }
      return leadIds.includes(l.id);
    });

    const acknowledgedIds = [];
    for (const l of targetLeads) {
      const nextAckBy = {
        ...(l.hotLeadAcknowledgedBy || {}),
        [userId]: nowMs
      };
      // IMPORTANT: Only mark hot lead alert as acknowledged.
      // Do NOT change leadStatus, leadScore, leadType, conv.aiEnabled, or conv.humanTakeoverActive.
      await Lead.findOneAndUpdate(
        { id: l.id },
        {
          $set: {
            hotLeadAcknowledgedAt: nowMs,
            hotLeadAcknowledgedBy: nextAckBy
          }
        }
      );
      acknowledgedIds.push(l.id);
    }

    res.json({
      ok: true,
      acknowledgedLeadIds: acknowledgedIds,
      acknowledgedAt: nowMs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const leadId = req.body.id || `ld-${Date.now()}`;
    const rawScore = Number(req.body.leadScore ?? 75);
    const resolvedType =
      rawScore >= 81
        ? 'HOT'
        : req.body.leadType || (rawScore >= 31 ? 'WARM' : 'COLD');
    const isNowHot = resolvedType === 'HOT' || rawScore >= 81;
    const score = isNowHot ? Math.max(rawScore, 81) : rawScore;
    const nowMs = Date.now();
    const numericVal =
      req.body.estimatedValueInr ??
      (parseInt(String(req.body.budget || '').replace(/[^0-9]/g, ''), 10) || 0);

    // Link to existing conversation for this contact if present, or create one unless disabled
    let conv = await Conversation.findOne({ contactId: req.body.contactId });
    if (!conv && req.body.createConversation !== false) {
      conv = await Conversation.create({
        id: `conv-${Date.now()}`,
        contactId: req.body.contactId,
        leadId,
        assignedAgentId: req.body.assignedAgentId || 'admin-1',
        status: 'OPEN',
        aiEnabled: true,
        humanTakeoverActive: false,
        humanAttentionRecommended: false,
        needsHumanAttention: false,
        unreadCount: 0,
        lastMessage: `Lead created for ${req.body.interestedService || 'Inquiry'}`,
        lastMessageTime: nowStr,
        language: 'English',
        keyFinding:
          req.body.aiSummary ||
          `Interested in ${req.body.interestedService} · Budget: ${req.body.budget}`
      });
    } else if (conv) {
      conv.leadId = leadId;
      await conv.save();
    }

    const createdLead = await Lead.create({
      id: leadId,
      contactId: req.body.contactId,
      conversationId: conv ? conv.id : '',
      leadStatus: req.body.leadStatus || 'NEW',
      leadType: isNowHot ? 'HOT' : resolvedType,
      leadScore: score,
      scoreBreakdown: req.body.scoreBreakdown || {
        budgetReadiness: Math.min(25, Math.round(score * 0.25)),
        needSpecificity: Math.min(25, Math.round(score * 0.25)),
        timelineUrgency: Math.min(20, Math.round(score * 0.2)),
        decisionAuthority: Math.min(15, Math.round(score * 0.15)),
        engagementDepth: Math.min(15, Math.round(score * 0.15))
      },
      interestedService: req.body.interestedService || 'General Inquiry',
      budget: req.body.budget || 'Not disclosed',
      estimatedValueInr: numericVal,
      timeline: req.body.timeline || 'Not specified',
      requirements: Array.isArray(req.body.requirements) ? req.body.requirements : [],
      buyingSignals: Array.isArray(req.body.buyingSignals)
        ? req.body.buyingSignals
        : ['Lead created with service requirement'],
      detectedObjections: Array.isArray(req.body.detectedObjections)
        ? req.body.detectedObjections
        : [],
      recommendedNextAction:
        req.body.recommendedNextAction ||
        'Handover this lead to a human sales representative.',
      customerSentiment: req.body.customerSentiment || 'Positive & High Intent',
      source: req.body.source || 'WhatsApp Inbound',
      assignedAgentId: req.body.assignedAgentId || 'admin-1',
      aiSummary:
        req.body.aiSummary ||
        `Lead inquiring about ${req.body.interestedService || 'services'} with budget ${
          req.body.budget || 'TBD'
        }.`,
      purchaseIntent: Boolean(req.body.purchaseIntent ?? score >= 75),
      lastInteractionAt: 'Just now',
      previousLeadStatus: 'NEW',
      previousLeadType: 'NEW',
      lastHotTransitionAt: isNowHot ? nowMs : 0,
      hotLeadNotifiedAt: isNowHot ? nowMs : 0,
      hotLeadAcknowledgedAt: 0,
      hotLeadAcknowledgedBy: {},
      createdAt: todayStr,
      updatedAt: todayStr,
      notes: []
    });

    if (isNowHot) {
      const contact = await Contact.findOne({ id: req.body.contactId });
      await Notification.create({
        id: `notif-hot-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'HOT_LEAD',
        title: '🔥 Hot Lead Alert',
        message: `${contact?.name || 'Customer'} (${score}/100 — HOT) is ready for sales follow-up.`,
        createdAt: 'Just now',
        isRead: false,
        linkTo: `/leads/${createdLead.id}`
      });
    }

    res.status(201).json({
      lead: cleanDoc(createdLead),
      conversation: cleanDoc(conv)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/leads/:id', async (req, res) => {
  try {
    const existingLead = await Lead.findOne({ id: req.params.id });
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const prevScore = Number(existingLead.leadScore ?? 50);
    const prevType =
      existingLead.leadType || (prevScore >= 81 ? 'HOT' : prevScore >= 31 ? 'WARM' : 'COLD');
    const wasHot = prevType === 'HOT' || prevScore >= 81;

    const hasScoreUpdate = req.body.leadScore !== undefined;
    const hasTypeUpdate = req.body.leadType !== undefined;

    let nextScore = hasScoreUpdate ? Number(req.body.leadScore) : prevScore;
    let nextType = prevType;

    if (hasScoreUpdate) {
      if (nextScore >= 81) {
        nextType = 'HOT';
      } else if (hasTypeUpdate && req.body.leadType !== 'HOT') {
        nextType = req.body.leadType;
      } else {
        nextType = nextScore >= 31 ? 'WARM' : 'COLD';
      }
    } else if (hasTypeUpdate) {
      nextType = req.body.leadType;
      if (nextType === 'HOT' && nextScore < 81) {
        nextScore = 85;
      } else if (nextType !== 'HOT' && nextScore >= 81) {
        nextScore = nextType === 'WARM' ? 75 : 25;
      }
    }

    const isNowHot = nextScore >= 81 || nextType === 'HOT';
    const patch = {
      ...req.body,
      leadScore: nextScore,
      leadType: isNowHot ? 'HOT' : nextType,
      updatedAt: new Date().toISOString().slice(0, 10)
    };

    if (!wasHot && isNowHot) {
      const nowMs = Date.now();
      patch.previousLeadStatus = existingLead.leadStatus || 'NEW';
      patch.previousLeadType = prevType;
      patch.lastHotTransitionAt = nowMs;
      patch.hotLeadNotifiedAt = nowMs;
      patch.hotLeadAcknowledgedAt = 0;
      patch.hotLeadAcknowledgedBy = {};

      const contact = await Contact.findOne({ id: existingLead.contactId });
      await Notification.create({
        id: `notif-hot-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'HOT_LEAD',
        title: '🔥 Hot Lead Alert',
        message: `${contact?.name || 'Customer'} reached ${nextScore}/100 (HOT) for ${
          patch.interestedService || existingLead.interestedService || 'Inquiry'
        }.`,
        createdAt: 'Just now',
        isRead: false,
        linkTo: `/leads/${existingLead.id}`
      });
    } else if (wasHot && !isNowHot) {
      patch.previousLeadStatus = existingLead.leadStatus || 'NEW';
      patch.previousLeadType = 'HOT';
      patch.lastHotTransitionAt = 0;
    }

    const updated = await Lead.findOneAndUpdate(
      { id: req.params.id },
      { $set: patch },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    await Promise.all([
      Lead.findOneAndDelete({ id: leadId }),
      FollowUp.deleteMany({ leadId }),
      // Unlink leadId from any related WhatsApp conversation while preserving the conversation and contact
      Conversation.updateMany({ leadId }, { $set: { leadId: '' } })
    ]);
    res.json({ deleted: true, leadId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/:id/notes', async (req, res) => {
  try {
    const note = {
      id: `ln-${Date.now()}`,
      content: req.body.content,
      authorName: req.body.authorName || 'Admin',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = await Lead.findOneAndUpdate(
      { id: req.params.id },
      { $push: { notes: { $each: [note], $position: 0 } } },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Conversations & WhatsApp Messages
app.post('/api/conversations', async (req, res) => {
  try {
    const { contactId, leadId, assignedAgentId } = req.body || {};
    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    let existingConv = await Conversation.findOne({ contactId });
    const contact = await Contact.findOne({ id: contactId });
    const lead = leadId
      ? await Lead.findOne({ id: leadId })
      : await Lead.findOne({ contactId });

    if (existingConv) {
      if (lead && !existingConv.leadId) {
        existingConv.leadId = lead.id;
        await existingConv.save();
      }
      if (lead && lead.conversationId !== existingConv.id) {
        lead.conversationId = existingConv.id;
        await lead.save();
      }
      return res.json({
        conversation: cleanDoc(existingConv),
        created: false
      });
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const convId = req.body.id || `conv-${Date.now()}`;

    const createdConv = await Conversation.create({
      id: convId,
      contactId,
      leadId: lead ? lead.id : leadId || '',
      assignedAgentId: assignedAgentId || lead?.assignedAgentId || 'admin-1',
      status: 'OPEN',
      aiEnabled: true,
      humanTakeoverActive: false,
      humanAttentionRecommended: false,
      needsHumanAttention: false,
      unreadCount: 0,
      lastMessage: 'WhatsApp conversation opened in CRM',
      lastMessageTime: nowStr,
      language: contact?.preferredLanguage || 'English',
      keyFinding: lead?.aiSummary || `Active WhatsApp conversation with ${contact?.name || 'customer'}`
    });

    if (lead) {
      lead.conversationId = createdConv.id;
      await lead.save();
    }

    res.status(201).json({
      conversation: cleanDoc(createdConv),
      created: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const convId = req.params.id;
    const existing = await Conversation.findOne({ id: convId });
    const updates = [
      Conversation.findOneAndDelete({ id: convId }),
      Message.deleteMany({ conversationId: convId }),
      Lead.updateMany({ conversationId: convId }, { $set: { conversationId: '' } })
    ];
    if (existing?.leadId) {
      updates.push(Lead.updateMany({ id: existing.leadId }, { $set: { conversationId: '' } }));
    }
    await Promise.all(updates);
    res.json({ deleted: true, conversationId: convId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch('/api/conversations/:id', async (req, res) => {
  try {
    const rawPatch = { ...(req.body.patch || req.body) };
    delete rawPatch.systemMessage;

    if (rawPatch.humanTakeoverActive === true || rawPatch.aiEnabled === false) {
      rawPatch.humanTakeoverActive = true;
      rawPatch.aiEnabled = false;
      rawPatch.status = 'HUMAN_HANDOFF';
    } else if (rawPatch.humanTakeoverActive === false || rawPatch.aiEnabled === true) {
      rawPatch.humanTakeoverActive = false;
      rawPatch.aiEnabled = true;
      rawPatch.humanAttentionRecommended = false;
      rawPatch.needsHumanAttention = false;
      rawPatch.handoffReason = '';
      rawPatch.status = 'OPEN';
    }

    const conv = await Conversation.findOneAndUpdate(
      { id: req.params.id },
      { $set: rawPatch },
      { new: true }
    );

    let systemMsg = null;
    if (req.body.systemMessage) {
      systemMsg = await Message.create({
        id: `msg-sys-${Date.now()}`,
        conversationId: req.params.id,
        whatsappMessageId: `sys.${Date.now()}`,
        senderType: 'SYSTEM',
        senderName: 'System',
        content: req.body.systemMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliveryStatus: 'READ'
      });
    }

    res.json({
      conversation: cleanDoc(conv),
      systemMessage: cleanDoc(systemMsg)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { content, senderName } = req.body;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const conv = await Conversation.findOne({ id: conversationId });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const contact = await Contact.findOne({ id: conv.contactId });

    // Send real WhatsApp message if Cloud API credentials & customer phone exist
    let wamid = `wamid.agent.${Date.now()}`;
    let deliveryStatus = 'DELIVERED';
    if (contact?.phone) {
      const waResult = await sendWhatsAppCloudMessage(contact.phone, content.trim());
      if (waResult.sent && waResult.whatsappMessageId) {
        wamid = waResult.whatsappMessageId;
        deliveryStatus = 'SENT';
      }
    }

    const newMsg = await Message.create({
      id: `msg-${Date.now()}`,
      conversationId,
      whatsappMessageId: wamid,
      senderType: 'HUMAN_AGENT',
      senderName: senderName || 'Agent',
      content: content.trim(),
      timestamp: nowStr,
      deliveryStatus
    });

    conv.lastMessage = content.trim();
    conv.lastMessageTime = nowStr;
    conv.unreadCount = 0;
    conv.humanAttentionRecommended = false;
    conv.needsHumanAttention = false;
    await conv.save();

    if (contact) {
      contact.lastInteractionAt = 'Just now';
      contact.totalMessages = (contact.totalMessages || 0) + 1;
      await contact.save();
    }

    res.status(201).json({
      message: cleanDoc(newMsg),
      conversation: cleanDoc(conv)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conversations/:id/incoming', async (req, res) => {
  try {
    const result = await handleIncomingCustomerMessage({
      conversationId: req.params.id,
      content: req.body.content,
      languageHint: req.body.languageHint
    });

    res.status(201).json({
      customerMsg: cleanDoc(result.customerMsg),
      aiMsg: cleanDoc(result.aiMsg),
      conversation: cleanDoc(result.conversation),
      lead: cleanDoc(result.lead),
      aiStructured: result.aiStructured
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Follow-Ups CRUD
app.post('/api/follow-ups', async (req, res) => {
  try {
    const created = await FollowUp.create({
      ...req.body,
      id: req.body.id || `fu-${Date.now()}`
    });
    res.status(201).json(cleanDoc(created));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/follow-ups/:id', async (req, res) => {
  try {
    const updated = await FollowUp.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/follow-ups/:id', async (req, res) => {
  try {
    await FollowUp.findOneAndDelete({ id: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Knowledge Base & Gaps CRUD (Write operations require ADMIN)
app.post('/api/knowledge-base', requireAdmin, async (req, res) => {
  try {
    const created = await KnowledgeBase.create({
      ...req.body,
      id: req.body.id || `kb-${Date.now()}`,
      updatedAt: new Date().toISOString().slice(0, 10),
      usageCount: req.body.usageCount ?? 1
    });
    res.status(201).json(cleanDoc(created));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/knowledge-base/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await KnowledgeBase.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          ...req.body,
          updatedAt: new Date().toISOString().slice(0, 10)
        }
      },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge-base/:id', requireAdmin, async (req, res) => {
  try {
    await KnowledgeBase.findOneAndDelete({ id: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/knowledge-gaps/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const gap = await KnowledgeGap.findOne({ id: req.params.id });
    if (!gap) return res.status(404).json({ error: 'Knowledge gap not found' });

    gap.resolved = true;
    await gap.save();

    const article = await KnowledgeBase.create({
      id: `kb-${Date.now()}`,
      category: gap.suggestedCategory || 'FAQ',
      title: gap.suggestedTitle,
      content: gap.suggestedContent,
      keywords: gap.suggestedTitle.toLowerCase().split(/\s+/).slice(0, 5),
      isActive: true,
      updatedAt: new Date().toISOString().slice(0, 10),
      usageCount: gap.occurrences || 1
    });

    res.json({
      gap: cleanDoc(gap),
      article: cleanDoc(article)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Settings & Notifications
app.post('/api/ai/test', async (req, res) => {
  try {
    await connectDB();
    const sysCfg = await getRuntimeSystemConfig(req);
    const message = String(req.body?.message || 'Hello').trim();
    const aiSettingDoc = await Setting.findOne({ type: 'aiSettings' });
    const aiSettings = aiSettingDoc?.data || INITIAL_AI_SETTINGS;
    const knowledgeBase = await KnowledgeBase.find({});

    const result = await generateAIQualificationAndReply({
      customerMessage: message,
      contact: { name: 'Test User', phone: '' },
      lead: null,
      historyMessages: [],
      knowledgeBase,
      aiSettings
    });

    res.json({
      ok: true,
      configuredProvider: sysCfg.aiProvider || aiSettings.provider || 'GEMINI',
      configuredGeminiModel: sysCfg.geminiModel || aiSettings.model || 'gemini-3.5-flash-lite',
      configuredOpenaiModel: sysCfg.openaiModel || 'gpt-4o-mini',
      geminiApiKeyConfigured: sysCfg.geminiApiKeyConfigured,
      openaiApiKeyConfigured: sysCfg.openaiApiKeyConfigured,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      input: message,
      output: result
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch('/api/settings/:type', requireAdmin, async (req, res) => {
  try {
    const type = req.params.type;
    if (type === 'systemConfig' || type === 'system' || type === 'integrations') {
      return await handleUpdateAdminConfig(req, res);
    }

    const body = { ...(req.body || {}) };
    const sysUpdates = {};
    if (typeof body.geminiApiKey === 'string' && body.geminiApiKey.trim()) {
      sysUpdates.geminiApiKeyEncrypted = encryptSecret(body.geminiApiKey.trim());
    }
    if (typeof body.openaiApiKey === 'string' && body.openaiApiKey.trim()) {
      sysUpdates.openaiApiKeyEncrypted = encryptSecret(body.openaiApiKey.trim());
    }
    if (typeof body.metaAppSecret === 'string' && body.metaAppSecret.trim()) {
      sysUpdates.metaAppSecretEncrypted = encryptSecret(body.metaAppSecret.trim());
    }
    if (typeof body.whatsappVerifyToken === 'string' && body.whatsappVerifyToken.trim()) {
      sysUpdates.whatsappVerifyTokenEncrypted = encryptSecret(body.whatsappVerifyToken.trim());
    }
    if (typeof body.verifyToken === 'string' && body.verifyToken.trim()) {
      sysUpdates.whatsappVerifyTokenEncrypted = encryptSecret(body.verifyToken.trim());
    }

    if (type === 'aiSettings') {
      if (typeof body.provider === 'string' && body.provider.trim()) {
        sysUpdates.aiProvider =
          body.provider.trim().toUpperCase() === 'OPENAI' ? 'OPENAI' : 'GEMINI';
      }
      if (typeof body.model === 'string' && body.model.trim()) {
        if (body.model.trim().startsWith('gemini')) {
          sysUpdates.geminiModel = body.model.trim();
        } else {
          sysUpdates.openaiModel = body.model.trim();
        }
      }
      if (typeof body.geminiModel === 'string' && body.geminiModel.trim()) {
        sysUpdates.geminiModel = body.geminiModel.trim();
      }
      if (typeof body.openaiModel === 'string' && body.openaiModel.trim()) {
        sysUpdates.openaiModel = body.openaiModel.trim();
      }
    }

    if (Object.keys(sysUpdates).length > 0) {
      sysUpdates.updatedBy = req.authUser?.email || req.authUser?.name || 'Admin';
      sysUpdates.updatedAt = new Date().toISOString();
      await SystemConfig.findOneAndUpdate(
        { id: 'primary' },
        { $set: sysUpdates },
        { upsert: true }
      );
    }

    // Never store raw secrets or removed n8n fields inside Setting documents
    delete body.geminiApiKey;
    delete body.openaiApiKey;
    delete body.metaAppSecret;
    delete body.whatsappVerifyToken;
    delete body.verifyToken;
    delete body.accessToken;
    delete body.n8nEnabled;
    delete body.n8nWebhookUrl;
    delete body.n8nForwardingEnabled;

    const existing = await Setting.findOne({ type });
    const existingClean = { ...(existing?.data || {}) };
    delete existingClean.geminiApiKey;
    delete existingClean.openaiApiKey;
    delete existingClean.metaAppSecret;
    delete existingClean.whatsappVerifyToken;
    delete existingClean.verifyToken;
    delete existingClean.accessToken;
    delete existingClean.n8nEnabled;
    delete existingClean.n8nWebhookUrl;
    delete existingClean.n8nForwardingEnabled;

    const mergedData = { ...existingClean, ...body };

    const updated = await Setting.findOneAndUpdate(
      { type },
      { type, data: mergedData },
      { upsert: true, new: true }
    );
    res.json(updated.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isRead: true } },
      { new: true }
    );
    res.json(cleanDoc(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', async (_req, res) => {
  try {
    await Notification.updateMany({}, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database offline error middleware fallback
app.use((err, req, res, next) => {
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    err.message?.includes('buffering timed out')
  ) {
    console.warn('[AI Studio] Database offline — returning mock empty response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  console.error('[server error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ============================================================================
// FRONTEND SERVING (STATIC DIST IN PROD, VITE MIDDLEWARE IN DEV)
// ============================================================================
async function startServer() {
  const hasDist = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  if (IS_PRODUCTION && hasDist) {
    app.use(express.static(DIST_DIR));

    app.get(/.*/, (req, res, next) => {
      if (
        req.method !== 'GET' ||
        req.path.startsWith('/api') ||
        WEBHOOK_PATHS.has(req.path)
      ) {
        return next();
      }
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    // Resilient fallback for any hashed asset requests (e.g. if browser cached an earlier build's CSS or JS link)
    if (hasDist) {
      app.get('/assets/:file', (req, res, next) => {
        const filePath = path.join(DIST_DIR, 'assets', req.params.file);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
        const assetsDir = path.join(DIST_DIR, 'assets');
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          if (req.params.file.endsWith('.css')) {
            const cssFile = files.find((f) => f.endsWith('.css'));
            if (cssFile) {
              res.type('text/css');
              return res.sendFile(path.join(assetsDir, cssFile));
            }
          }
          if (req.params.file.endsWith('.js')) {
            const jsFile = files.find((f) => f.endsWith('.js'));
            if (jsFile) {
              res.type('application/javascript');
              return res.sendFile(path.join(assetsDir, jsFile));
            }
          }
        }
        res.status(404).type('text/plain').send('Asset Not Found');
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      // Do not return index.html for API routes, webhooks, or file requests with extensions
      if (
        req.method !== 'GET' ||
        url.startsWith('/api') ||
        WEBHOOK_PATHS.has(url) ||
        /\.[a-zA-Z0-9]+$/.test(req.path)
      ) {
        if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
          return res.status(404).type('text/plain').send('File Not Found');
        }
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  const INFRASTRUCTURE_ENV = ['MONGODB_URI', 'MONGODB_DB_NAME', 'JWT_SECRET', 'SETTINGS_ENCRYPTION_KEY'];

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(
      `[server] PulseFlow CRM listening on port ${PORT} (${
        IS_PRODUCTION ? 'production' : 'development'
      })`
    );

    const infraStatus = INFRASTRUCTURE_ENV.map(
      (n) => `${n}=${process.env[n] ? 'set' : 'unset'}`
    );
    console.log(
      `[server] infrastructure env — ${infraStatus.join(
        ' | '
      )} | app & integration secrets encrypted in MongoDB (AES-256-GCM)`
    );

    try {
      await connectDB();
    } catch (err) {
      console.error('[server] Initial database connection attempt failed:', err.message);
    }

    try {
      await validateWhatsAppCloudApiOnStartup();
    } catch (err) {
      console.warn('[server] WhatsApp Cloud API startup check error:', err.message);
    }
  });
}

startServer();
