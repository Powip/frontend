/**
 * Estado global de «la sesión venció de verdad» (la renovación respondió que el
 * token no vale) y destino de retorno tras volver a iniciar sesión.
 */
import { isPublicLiveRoute } from "./liveRoutes";

/** Canal entre pestañas: si otra cerró sesión a mano, aquí no sale el aviso. */
export const SESSION_CHANNEL = "powip-session";
export const RETURN_PARAM = "volver";

let expired = false;
let manualLogout = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function subscribeSessionExpiry(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const isSessionExpired = () => expired;
export const wasManualLogout = () => manualLogout;

export function markSessionExpired() {
  if (expired) return;
  expired = true;
  emit();
}

function openChannel(): BroadcastChannel | null {
  // Sin BroadcastChannel solo se pierde la coordinación entre pestañas.
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(SESSION_CHANNEL);
}

function announce(loggedOut: boolean) {
  const channel = openChannel();
  channel?.postMessage(loggedOut);
  channel?.close();
}

export function markSessionStarted() {
  expired = false;
  manualLogout = false;
  announce(false);
  emit();
}

export function markManualLogout() {
  expired = false;
  manualLogout = true;
  announce(true);
  emit();
}

/** Refleja el inicio o cierre de sesión hecho en otra pestaña. */
export function listenOtherTabs(): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent) => {
    manualLogout = event.data === true;
    emit();
  };
  return () => channel.close();
}

/** Solo el 401 propio del proxy significa «el token ya no vale»; red, 5xx, 429 o CSRF no. */
export function isExpiredSessionResponse(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | null)
    ?.response;
  return response?.status === 401 && response.data?.code === "AUTH_SESSION_REQUIRED";
}

/** Páginas que se usan sin sesión: ahí no se interrumpe a nadie. */
export function isAnonymousRoute(pathname: string): boolean {
  return (
    isPublicLiveRoute(pathname) ||
    ["/login", "/restablecer-contrasena", "/rastreo", "/c/"].some((route) =>
      pathname.startsWith(route),
    ) ||
    pathname === "/partners/solicitud"
  );
}

const INTERNAL_ORIGIN = "http://interno.invalid";

/** Devuelve la ruta solo si es interna; evita open redirect (URLs externas, //host, \host). */
export function safeReturnPath(raw: string | null | undefined): string | null {
  // El navegador ignora tabs y saltos de línea y trata «\» como «/».
  if (!raw || !raw.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, INTERNAL_ORIGIN);
  } catch {
    return null;
  }
  // Se valida también el resultado: «/..//host» se normaliza a «//host».
  if (url.origin !== INTERNAL_ORIGIN || url.pathname.startsWith("//")) return null;
  if (url.pathname === "/" || /^\/(?:login|api)(?:\/|$)/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginUrl(returnPath?: string | null): string {
  const safe = safeReturnPath(returnPath);
  return safe ? `/login?${RETURN_PARAM}=${encodeURIComponent(safe)}` : "/login";
}
