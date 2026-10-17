// Meta Facebook Login for Business / WhatsApp Embedded Signup (v4) client.
// Loads the official Meta JS SDK, opens the Meta-hosted onboarding popup and
// returns BOTH channels Meta uses:
//   1. FB.login callback   → short-lived authorization code (TTL ~30s)
//   2. window postMessage  → WA_EMBEDDED_SIGNUP session data (asset IDs)
// The authorization code is forwarded to the PulseFlow backend over HTTPS and
// is never stored, logged or persisted in the browser.

const FB_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const SCRIPT_ID = 'pulseflow-facebook-jssdk';

let sdkInitPromise = null;

function loadScriptOnce() {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (window.FB) return resolve(window.FB);
      existing.addEventListener('load', () => resolve(window.FB));
      existing.addEventListener('error', () =>
        reject(new Error('The Meta SDK failed to load. Check your network or content blockers.'))
      );
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = FB_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.FB);
    script.onerror = () =>
      reject(new Error('The Meta SDK failed to load. Check your network or content blockers.'));
    document.head.appendChild(script);
  });
}

export function initFacebookSdk({ appId, version }) {
  if (!appId) {
    return Promise.reject(new Error('META_APP_ID is not configured on the server.'));
  }
  if (window.FB && window.__pulseflowFbAppId === appId) {
    return Promise.resolve(window.FB);
  }
  if (sdkInitPromise) return sdkInitPromise;

  sdkInitPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      sdkInitPromise = null;
      reject(new Error('Timed out while loading the Meta SDK.'));
    }, 15000);

    window.fbAsyncInit = function fbAsyncInit() {
      clearTimeout(timeout);
      try {
        window.FB.init({
          appId: String(appId),
          autoLogAppEvents: true,
          xfbml: true,
          version: String(version || 'v26.0')
        });
        window.__pulseflowFbAppId = String(appId);
        sdkInitPromise = null;
        resolve(window.FB);
      } catch (err) {
        sdkInitPromise = null;
        reject(err);
      }
    };

    if (window.FB) {
      window.fbAsyncInit();
      return;
    }
    loadScriptOnce().catch((err) => {
      clearTimeout(timeout);
      sdkInitPromise = null;
      reject(err);
    });
  });

  return sdkInitPromise;
}

function makeSignupError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function isMetaOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  return /(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(origin.replace(/^https?:\/\//, ''));
}

function parseMessageData(event) {
  let data = event.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  if (data.type !== 'WA_EMBEDDED_SIGNUP') return null;
  return data;
}

/**
 * Opens the Meta-hosted WhatsApp Embedded Signup flow.
 * Resolves with { code, eventData } — sendData immediately to the backend.
 */
export function startEmbeddedSignup({ appId, version, configId, coexistenceEnabled = true }) {
  return new Promise(async (resolve, reject) => {
    if (!configId) {
      reject(
        makeSignupError(
          'NOT_CONFIGURED',
          'Embedded Signup is not available yet. Complete the Meta App Review / permission configuration before enabling customer onboarding.'
        )
      );
      return;
    }

    let FB;
    try {
      FB = await initFacebookSdk({ appId, version });
    } catch (err) {
      reject(makeSignupError('SDK_LOAD_FAILED', err.message));
      return;
    }

    let settled = false;
    let authCode = null;
    let sessionData = null;
    let codeGraceTimer = null;
    let watchdog = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (codeGraceTimer) clearTimeout(codeGraceTimer);
      if (watchdog) clearTimeout(watchdog);
    };

    const fail = (code, message) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(makeSignupError(code, message));
    };

    const succeed = () => {
      if (settled || !authCode) return;
      settled = true;
      cleanup();
      resolve({
        code: authCode,
        eventData: sessionData
          ? { event: sessionData.event || '', data: sessionData.data || {}, version: sessionData.version }
          : null
      });
    };

    const onMessage = (event) => {
      if (settled) return;
      if (!isMetaOrigin(event.origin)) return;
      const payload = parseMessageData(event);
      if (!payload) return;

      if (payload.event === 'CANCEL') {
        const detail = payload.data?.error_message || payload.error_message || '';
        fail(
          'CANCELLED',
          detail
            ? `Meta authorization was cancelled: ${detail} Your existing WhatsApp connection was not changed.`
            : 'Meta authorization was cancelled. Your existing WhatsApp connection was not changed.'
        );
        return;
      }

      sessionData = payload;
      if (authCode) {
        succeed();
      } else {
        // Session finished but the auth code has not arrived yet — short grace period.
        codeGraceTimer = setTimeout(() => {
          if (!authCode) {
            fail(
              'AUTH_CODE_MISSING',
              'Meta did not return an authorization code. Your existing WhatsApp connection was not changed.'
            );
          } else {
            succeed();
          }
        }, 4000);
      }
    };

    // Register the session/message listener BEFORE starting login.
    window.addEventListener('message', onMessage);

    watchdog = setTimeout(() => {
      fail(
        'TIMEOUT',
        'The Meta connection window did not respond in time. Please try connecting again.'
      );
    }, 120000);

    const extras = coexistenceEnabled
      ? {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3'
        }
      : { setup: {} };

    try {
      FB.login(
        (response) => {
          if (settled) return;
          const authResponse = response?.authResponse;
          if (authResponse && authResponse.code) {
            authCode = String(authResponse.code);
            if (sessionData) {
              succeed();
            } else {
              // Asset/session message may arrive just before or after the code.
              codeGraceTimer = setTimeout(succeed, 3000);
            }
            return;
          }
          if (response?.error || response?.status === 'user_cancel' || response?.error?.code === 4201) {
            fail(
              'CANCELLED',
              'Meta authorization was cancelled. Your existing WhatsApp connection was not changed.'
            );
            return;
          }
          fail(
            'DENIED',
            'Meta authorization was not completed. Your existing WhatsApp connection was not changed.'
          );
        },
        {
          config_id: String(configId),
          response_type: 'code',
          override_default_response_type: true,
          extras
        }
      );
    } catch (err) {
      fail(
        'LOGIN_FAILED',
        err?.message || 'The Meta connection window could not be opened. Check your popup blocker.'
      );
    }
  });
}
