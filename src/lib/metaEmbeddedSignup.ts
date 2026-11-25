/**
 * WhatsApp Embedded Signup ("Conectar con Facebook") in the browser.
 *
 * Loads Meta's JS SDK, opens FB.login with the Embedded Signup configuration and returns the
 * short-lived `code` plus the WABA / phone number ids Meta posts back through `window.message`.
 * The backend (ms-integrations) exchanges the code; no secret ever reaches the browser.
 *
 * When ms-integrations runs against the local simulator (`simulated: true`) the SDK is skipped
 * and a fixed code is returned, so the whole flow can be tested without a Meta app.
 */

export const SIMULATED_EMBEDDED_SIGNUP_CODE = "SIMULATED_CODE";
const SDK_URL = "https://connect.facebook.net/es_LA/sdk.js";
const SDK_SCRIPT_ID = "facebook-jssdk";

export interface EmbeddedSignupLaunchConfig {
  appId: string | null;
  configId: string | null;
  apiVersion: string;
  simulated: boolean;
}

export interface EmbeddedSignupResult {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

interface FbLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}

interface FbSdk {
  init(options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
  login(
    callback: (response: FbLoginResponse) => void,
    options: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

export class EmbeddedSignupCancelledError extends Error {
  constructor() {
    super("Se cerró la ventana de Facebook sin terminar la conexión.");
    this.name = "EmbeddedSignupCancelledError";
  }
}

let sdkPromise: Promise<FbSdk> | null = null;

/** Loads the SDK once and runs FB.init with the app id. */
export function loadFacebookSdk(appId: string, version: string): Promise<FbSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El SDK de Facebook solo carga en el navegador."));
  }
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FbSdk>((resolve, reject) => {
    const init = () => {
      if (!window.FB) {
        reject(new Error("No se pudo cargar el SDK de Facebook."));
        return;
      }
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
    };
    if (window.FB) {
      init();
      return;
    }
    window.fbAsyncInit = init;
    if (!document.getElementById(SDK_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SDK_SCRIPT_ID;
      script.src = SDK_URL;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("No se pudo cargar el SDK de Facebook (revisa bloqueadores)."));
      };
      document.body.appendChild(script);
    }
  });
  return sdkPromise;
}

/** Test hook: forget the cached SDK promise. */
export function resetFacebookSdkForTests() {
  sdkPromise = null;
}

/**
 * Reads the `WA_EMBEDDED_SIGNUP` message Meta posts from facebook.com when the user finishes.
 * Returns ids only for the FINISH events; anything else returns null.
 */
export function parseEmbeddedSignupMessage(
  origin: string,
  data: unknown,
): { wabaId?: string; phoneNumberId?: string } | null {
  if (!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/i.test(origin)) return null;
  let payload: unknown = data;
  if (typeof data === "string") {
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
  }
  const msg = payload as {
    type?: string;
    event?: string;
    data?: { waba_id?: string; phone_number_id?: string };
  };
  if (msg?.type !== "WA_EMBEDDED_SIGNUP") return null;
  if (!msg.event || !msg.event.startsWith("FINISH")) return null;
  return {
    ...(msg.data?.waba_id ? { wabaId: msg.data.waba_id } : {}),
    ...(msg.data?.phone_number_id ? { phoneNumberId: msg.data.phone_number_id } : {}),
  };
}

/** Opens the Embedded Signup popup and resolves with the code and the shared ids. */
export async function launchEmbeddedSignup(
  config: EmbeddedSignupLaunchConfig,
): Promise<EmbeddedSignupResult> {
  if (config.simulated) {
    return { code: SIMULATED_EMBEDDED_SIGNUP_CODE };
  }
  if (!config.appId || !config.configId) {
    throw new Error("Falta configurar la app de Meta para «Conectar con Facebook».");
  }
  const fb = await loadFacebookSdk(config.appId, config.apiVersion);

  let shared: { wabaId?: string; phoneNumberId?: string } = {};
  const onMessage = (event: MessageEvent) => {
    const ids = parseEmbeddedSignupMessage(event.origin, event.data);
    if (ids) shared = { ...shared, ...ids };
  };
  window.addEventListener("message", onMessage);

  try {
    const code = await new Promise<string>((resolve, reject) => {
      fb.login(
        (response) => {
          const value = response.authResponse?.code;
          if (value) resolve(value);
          else reject(new EmbeddedSignupCancelledError());
        },
        {
          config_id: config.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
        },
      );
    });
    return { code, ...shared };
  } finally {
    window.removeEventListener("message", onMessage);
  }
}

/**
 * «Conectar con Facebook» para Instagram y Messenger (Facebook Login for Business).
 * Abre FB.login con la configuración de la app (config_id en lugar de scope) y devuelve el `code`
 * que canjea ms-integrations. En modo simulador no abre Meta y devuelve el code fijo.
 * https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
 */
export async function launchFacebookLogin(config: EmbeddedSignupLaunchConfig): Promise<string> {
  if (config.simulated) return SIMULATED_EMBEDDED_SIGNUP_CODE;
  if (!config.appId || !config.configId) {
    throw new Error("Falta configurar la app de Meta para «Conectar con Facebook».");
  }
  const fb = await loadFacebookSdk(config.appId, config.apiVersion);
  return new Promise<string>((resolve, reject) => {
    fb.login(
      (response) => {
        const value = response.authResponse?.code;
        if (value) resolve(value);
        else reject(new EmbeddedSignupCancelledError());
      },
      { config_id: config.configId, response_type: "code", override_default_response_type: true },
    );
  });
}
