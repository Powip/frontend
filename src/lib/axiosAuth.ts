import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "./tokenStore";
import { GATEWAY } from "./gateway";

const API_AUTH = GATEWAY.auth;

let _refreshPromise: Promise<string | null> | null = null;

// Circuit breaker: si algo en la app queda re-disparando refresh (p. ej. un
// efecto de React con una dependencia que cambia en cada refresh), esto evita
// machacar el backend hasta que la rotación del refresh token lo invalide —
// preferimos un logout limpio y explicable a un 401 silencioso post-rotación.
const REFRESH_STORM_WINDOW_MS = 10000;
const REFRESH_STORM_MAX_CALLS = 8;
let _refreshTimestamps: number[] = [];

function isRefreshStorm(): boolean {
  const now = Date.now();
  _refreshTimestamps = _refreshTimestamps.filter(
    (t) => now - t < REFRESH_STORM_WINDOW_MS,
  );
  _refreshTimestamps.push(now);
  return _refreshTimestamps.length > REFRESH_STORM_MAX_CALLS;
}

async function doRefresh(): Promise<string | null> {
  if (isRefreshStorm()) {
    console.error(
      `[axiosAuth] Refresh storm detected (>${REFRESH_STORM_MAX_CALLS} calls in ${REFRESH_STORM_WINDOW_MS}ms) — forcing logout instead of continuing to hammer /auth/refresh.`,
    );
    tokenStore.set(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:logout"));
    }
    return null;
  }

  // El backend lee el refreshToken de la cookie httpOnly — el body es vacío intencionalmente.
  // timeout explícito: sin esto, axios espera indefinidamente (default = 0 = sin límite),
  // y si ms-auth se cuelga esperando el evento de rol, este request nunca resuelve.
  try {
    const res = await axios.post(
      `${API_AUTH}/api/v1/auth/refresh`,
      {},
      { withCredentials: true, timeout: 10000 },
    );
    const token: string | undefined = res.data?.accessToken;
    if (token) {
      tokenStore.set(token);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:refreshed", { detail: token }));
      }
      return token;
    }
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response === undefined) {
      // Error de red transitorio — no desloguear, puede ser temporal
      return null;
    }
    // Error de autenticación (4xx) — cookie inválida o revocada
  }

  tokenStore.set(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:logout"));
  }
  return null;
}

/**
 * Exportado para que AuthContext.silentRefresh lo use y compartan
 * el mismo _refreshPromise — evita la race condition de rotación de tokens.
 */
export function requestRefresh(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

const axiosAuth = axios.create();

axiosAuth.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosAuth.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      const newToken = await requestRefresh();
      if (newToken) {
        console.log(newToken)
        config.headers.Authorization = `Bearer ${newToken}`;
        return axiosAuth(config);
      }
    }
    return Promise.reject(error);
  },
);

export default axiosAuth;
