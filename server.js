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
  hashPassword,
  verifyPassword
} from './db.js';
import {
  INITIAL_AI_SETTINGS,
  INITIAL_WHATSAPP_SETTINGS,
  INITIAL_COMPANY_SETTINGS
} from './defaultData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
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

function verifySignature(req) {
  if (!APP_SECRET || APP_SECRET === 'replace_with_meta_app_secret_for_hmac_sha256') {
    return { ok: false, reason: 'app-secret-not-configured' };
  }

  const header = req.get('x-hub-signature-256');
  if (!header) return { ok: false, reason: 'signature-header-missing' };
  if (!header.startsWith('sha256=')) return { ok: false, reason: 'signature-malformed' };
  if (!req.rawBody || req.rawBody.length === 0) return { ok: false, reason: 'body-missing' };

  const expected =
    'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');

  return safeCompare(header, expected)
    ? { ok: true, reason: 'valid' }
    : { ok: false, reason: 'signature-mismatch' };
}

// Helper to send outgoing WhatsApp messages via Meta Cloud API
async function sendWhatsAppCloudMessage(toPhone, textBody) {
  const rawToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const token = rawToken.trim().replace(/['"]/g, '');
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token;

  const phoneId = (
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PHONE_NUMBER_ID !== '109283746512345'
      ? process.env.WHATSAPP_PHONE_NUMBER_ID
      : '1384094818114996'
  ).trim().replace(/['"]/g, '');

  let version = String(process.env.WHATSAPP_API_VERSION || 'v21.0')
    .trim()
    .replace(/['"]/g, '')
    .replace(/^\/+|\/+$/g, '');
  if (!version.startsWith('v')) version = `v${version}`;

  const cleanPhone = String(toPhone || '').replace(/[^0-9]/g, '');
  console.log(
    '[whatsapp-api] outgoing WhatsApp send started',
    JSON.stringify({
      to: cleanPhone || 'empty',
      phoneNumberId: phoneId || 'missing',
      apiVersion: version,
      tokenConfigured: Boolean(cleanToken),
      tokenLength: cleanToken.length,
      textLength: String(textBody || '').length
    })
  );

  if (!cleanToken || !phoneId || !toPhone) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({
        reason: 'missing-whatsapp-config',
        to: cleanPhone,
        hasToken: Boolean(cleanToken),
        hasPhoneId: Boolean(phoneId)
      })
    );
    return { sent: false, reason: 'missing-whatsapp-config' };
  }

  if (cleanPhone.length < 8) {
    console.warn(
      '[whatsapp-api] outgoing WhatsApp send failed',
      JSON.stringify({ reason: 'invalid-phone', to: cleanPhone })
    );
    return { sent: false, reason: 'invalid-phone' };
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
        diagnosticHint =
          `Error 131005 (Access denied): The access token lacks permission for WhatsApp Phone Number ID (${phoneId}). In Meta Business Manager, ensure the System User has "Full Control" asset permission on the WABA (${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1409996531275243'}), that the token has "whatsapp_business_messaging" scope, and that the phone number belongs to the same Meta App / WABA.`;
      } else if (errCode === 190) {
        diagnosticHint =
          'Error 190 (Invalid/Expired Access Token): The token is expired, revoked, or malformed. Configure a valid permanent System User token in Meta Business Manager.';
      } else if (errCode === 131030) {
        diagnosticHint =
          'Error 131030 (Recipient not in allowlist): When using a Meta sandbox test number, recipient numbers must be added to the allowed phone numbers list in WhatsApp API Setup.';
      }

      console.warn(
        '[whatsapp-api] outgoing WhatsApp send failed',
        JSON.stringify({
          to: cleanPhone,
          phoneNumberId: phoneId,
          apiVersion: version,
          tokenConfigured: Boolean(cleanToken),
          tokenLength: cleanToken.length,
          statusCode: response.status,
          errorCode: errCode,
          errorSubcode: errSubcode,
          errorType: errType,
          errorMessage: errMsg || `HTTP ${response.status}`,
          fbtraceId,
          diagnosticHint: diagnosticHint || undefined,
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
        phoneNumberId: phoneId,
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
        phoneNumberId: phoneId,
        apiVersion: version,
        tokenConfigured: Boolean(cleanToken),
        error: err.message,
        durationMs: Date.now() - t0
      })
    );
    return { sent: false, error: err.message };
  }
}

// Safe startup validation to diagnose WhatsApp credentials without leaking tokens
async function validateWhatsAppCloudApiOnStartup() {
  const rawToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const token = rawToken.trim().replace(/['"]/g, '');
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token;

  const phoneId = (
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PHONE_NUMBER_ID !== '109283746512345'
      ? process.env.WHATSAPP_PHONE_NUMBER_ID
      : '1384094818114996'
  ).trim().replace(/['"]/g, '');

  let version = String(process.env.WHATSAPP_API_VERSION || 'v21.0')
    .trim()
    .replace(/['"]/g, '')
    .replace(/^\/+|\/+$/g, '');
  if (!version.startsWith('v')) version = `v${version}`;

  const wabaId = (
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID && process.env.WHATSAPP_BUSINESS_ACCOUNT_ID !== '987654321098765'
      ? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
      : '1409996531275243'
  ).trim().replace(/['"]/g, '');

  console.log(
    '[whatsapp-startup-check] checking WhatsApp Cloud API credentials...',
    JSON.stringify({
      phoneNumberId: phoneId,
      wabaId,
      apiVersion: version,
      tokenConfigured: Boolean(cleanToken),
      tokenLength: cleanToken ? cleanToken.length : 0
    })
  );

  if (!cleanToken || cleanToken.includes('replace_with_meta_permanent_access_token')) {
    console.log(
      '[whatsapp-startup-check] Note: WHATSAPP_ACCESS_TOKEN is not configured with a live Meta permanent token. Inbound webhooks and simulated CRM replies are functional.'
    );
    return;
  }

  try {
    const url = `https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      console.log(
        '[whatsapp-startup-check] SUCCESS: Verified Meta WhatsApp Cloud API connection!',
        JSON.stringify({
          phoneNumberId: data.id || phoneId,
          displayPhoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating,
          statusCode: res.status
        })
      );
    } else {
      console.warn(
        '[whatsapp-startup-check] WARNING: Meta WhatsApp Cloud API returned access error on startup',
        JSON.stringify({
          phoneNumberId: phoneId,
          wabaId,
          apiVersion: version,
          statusCode: res.status,
          errorCode: data?.error?.code,
          errorSubcode: data?.error?.error_subcode,
          errorType: data?.error?.type,
          errorMessage: data?.error?.message,
          diagnosticHint:
            data?.error?.code === 131005
              ? 'Error 131005 (Access denied): The access token does not have permission for Phone Number ID ' +
                phoneId +
                '. In Meta Business Manager, ensure the System User has "Full Control" asset permission on WABA (' +
                wabaId +
                ') and "whatsapp_business_messaging" scope.'
              : undefined
        })
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

  const oaKey = (process.env.OPENAI_API_KEY || '').trim();
  const isGithubPat = oaKey.startsWith('github_pat_') || oaKey.startsWith('ghp_');
  const hasValidGeminiKey =
    Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';

  const envProvider = process.env.AI_PROVIDER
    ? String(process.env.AI_PROVIDER).toUpperCase()
    : null;

  // If OPENAI_API_KEY is a GitHub PAT rather than an sk- OpenAI key and Gemini is configured, route directly to Gemini
  const preferProvider =
    isGithubPat && hasValidGeminiKey
      ? 'GEMINI'
      : String(aiSettings.provider || envProvider || 'GEMINI').toUpperCase();

  // Helper to run OpenAI / GitHub Models
  const tryOpenAIProvider = async () => {
    if (!oaKey) return null;
    try {
      const endpoint = isGithubPat
        ? 'https://models.github.ai/inference/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      const baseModel =
        aiSettings.model && !aiSettings.model.startsWith('gemini')
          ? aiSettings.model
          : process.env.OPENAI_MODEL || 'gpt-4o-mini';
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
      console.warn('[ai-service] GEMINI_API_KEY not configured, skipping Gemini provider');
      return null;
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const rawConfiguredModel =
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
    }
  }

  return events;
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
function handleWebhookVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const tokenStr = Array.isArray(token)
    ? String(token[token.length - 1] ?? '')
    : String(token ?? '');

  if (mode === 'subscribe' && VERIFY_TOKEN && safeCompare(tokenStr, VERIFY_TOKEN)) {
    return res.status(200).type('text/plain').send(String(challenge));
  }

  console.warn(
    '[webhook] verification rejected',
    JSON.stringify({
      mode: mode === 'subscribe' ? 'subscribe' : 'unexpected-mode',
      verifyTokenConfigured: Boolean(VERIFY_TOKEN),
      challengeProvided: challenge !== undefined
    })
  );

  return res.sendStatus(403);
}

async function handleWebhookPost(req, res) {
  const signature = verifySignature(req);
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
        '[webhook] WHATSAPP_APP_SECRET not set — signature check skipped (non-production only)'
      );
    } else if (unconfigured) {
      console.error('[webhook] WHATSAPP_APP_SECRET missing in production — rejecting request');
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

app.get('/api/whatsapp/status', async (req, res) => {
  const rawToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const token = rawToken.trim().replace(/['"]/g, '');
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token;

  const phoneId = (
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PHONE_NUMBER_ID !== '109283746512345'
      ? process.env.WHATSAPP_PHONE_NUMBER_ID
      : '1384094818114996'
  ).trim().replace(/['"]/g, '');

  let version = String(process.env.WHATSAPP_API_VERSION || 'v21.0')
    .trim()
    .replace(/['"]/g, '')
    .replace(/^\/+|\/+$/g, '');
  if (!version.startsWith('v')) version = `v${version}`;

  const wabaId = (
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID && process.env.WHATSAPP_BUSINESS_ACCOUNT_ID !== '987654321098765'
      ? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
      : '1409996531275243'
  ).trim().replace(/['"]/g, '');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || '';

  const publicOrigin =
    process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL
      : `${req.protocol}://${req.get('host')}`;

  if (!cleanToken || cleanToken.includes('replace_with_meta_permanent_access_token')) {
    return res.json({
      webhookReady: Boolean(verifyToken),
      webhookUrl: `${publicOrigin}/webhook`,
      verifyTokenConfigured: Boolean(verifyToken),
      cloudApiConnected: false,
      phoneNumberId: phoneId || '',
      businessAccountId: wabaId || '',
      apiVersion: version,
      error: 'WHATSAPP_ACCESS_TOKEN is not configured with a live Meta token.'
    });
  }

  try {
    const url = `https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    const data = await response.json();

    if (!response.ok) {
      const errCode = data?.error?.code;
      let diagnosticHint = '';
      if (errCode === 131005) {
        diagnosticHint =
          `Error 131005 (Access denied): The access token does not have permission for Phone Number ID (${phoneId}). In Meta Business Manager, ensure the System User has "Full Control" asset permission on WABA (${wabaId}) with "whatsapp_business_messaging" scope.`;
      } else if (errCode === 190) {
        diagnosticHint =
          'Error 190 (Invalid/Expired Token): The access token is malformed, expired, or invalid. Please generate a new permanent System User access token in Meta Business Manager.';
      }

      return res.json({
        webhookReady: Boolean(verifyToken),
        webhookUrl: `${publicOrigin}/webhook`,
        verifyTokenConfigured: Boolean(verifyToken),
        cloudApiConnected: false,
        phoneNumberId: phoneId,
        businessAccountId: wabaId || '',
        apiVersion: version,
        error: data?.error?.message || `Meta Graph API HTTP ${response.status}`,
        errorCode: data?.error?.code,
        errorSubcode: data?.error?.error_subcode,
        errorType: data?.error?.type,
        diagnosticHint: diagnosticHint || undefined
      });
    }

    if (data.display_phone_number) {
      await Setting.findOneAndUpdate(
        { type: 'whatsappSettings' },
        {
          $set: {
            'data.displayPhoneNumber': data.display_phone_number,
            'data.isConnected': true,
            'data.phoneNumberId': data.id || phoneId,
            'data.businessAccountId': wabaId || ''
          }
        }
      ).catch(() => {});
    }

    return res.json({
      webhookReady: Boolean(verifyToken),
      webhookUrl: `${publicOrigin}/webhook`,
      verifyTokenConfigured: Boolean(verifyToken),
      appSecretConfigured: Boolean(
        APP_SECRET && APP_SECRET !== 'replace_with_meta_app_secret_for_hmac_sha256'
      ),
      cloudApiConnected: true,
      phoneNumberId: data.id || phoneId,
      businessAccountId: wabaId || '',
      apiVersion: version,
      displayPhoneNumber: data.display_phone_number || '',
      verifiedName: data.verified_name || '',
      qualityRating: data.quality_rating || ''
    });
  } catch (err) {
    return res.json({
      webhookReady: Boolean(verifyToken),
      webhookUrl: `${publicOrigin}/webhook`,
      verifyTokenConfigured: Boolean(verifyToken),
      cloudApiConnected: false,
      phoneNumberId: phoneId,
      businessAccountId: wabaId || '',
      apiVersion: version,
      error: err.message
    });
  }
});

// Diagnostic & direct test-send endpoint for testing outbound WhatsApp Cloud API
app.post('/api/whatsapp/test-send', async (req, res) => {
  try {
    const { to, message } = req.body || {};
    const recipient = to || '917306043445';
    const text = message || 'Test outbound message from PulseFlow CRM';

    const result = await sendWhatsAppCloudMessage(recipient, text);
    res.json({
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

// Helper to strip Mongoose _id / __v and sensitive password hash fields
const cleanDoc = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { _id, __v, passwordHash, passwordSalt, password, ...rest } = obj;
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

    const aiSettings =
      settingDocs.find((s) => s.type === 'aiSettings')?.data || INITIAL_AI_SETTINGS;
    const whatsappSettings =
      settingDocs.find((s) => s.type === 'whatsappSettings')?.data || INITIAL_WHATSAPP_SETTINGS;
    const companySettings =
      settingDocs.find((s) => s.type === 'companySettings')?.data || INITIAL_COMPANY_SETTINGS;

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
      configuredProvider: process.env.AI_PROVIDER || aiSettings.provider || 'GEMINI',
      configuredGeminiModel: process.env.GEMINI_MODEL || aiSettings.model || 'gemini-3.5-flash-lite',
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
    const existing = await Setting.findOne({ type });
    const mergedData = { ...(existing?.data || {}), ...req.body };

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

  const WEBHOOK_ENV_REQUIRED = ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'];
  const WEBHOOK_ENV_RESERVED = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    'WHATSAPP_API_VERSION',
    'MONGODB_URI',
    'JWT_SECRET',
    'GEMINI_API_KEY',
    'GEMINI_MODEL'
  ];

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(
      `[server] PulseFlow CRM listening on port ${PORT} (${
        IS_PRODUCTION ? 'production' : 'development'
      })`
    );

    const required = WEBHOOK_ENV_REQUIRED.map(
      (n) => `${n}=${process.env[n] ? 'set' : 'MISSING'}`
    );
    console.log(`[server] webhook env — ${required.join(' | ')}`);

    const reserved = WEBHOOK_ENV_RESERVED.map(
      (n) => `${n}=${process.env[n] ? 'set' : 'unset'}`
    );
    console.log(`[server] reserved env — ${reserved.join(' | ')}`);

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
