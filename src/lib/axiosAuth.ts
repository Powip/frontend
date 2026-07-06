import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { tokenStore } from "./tokenStore";
import { GATEWAY } from "./gateway";

const API_AUTH = GATEWAY.auth;

let _refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  // El backend lee el refreshToken de la cookie httpOnly — el body es vacío intencionalmente.
  try {
    const res = await axios.post(
      `${API_AUTH}/api/v1/auth/refresh`,
      {},
      { withCredentials: true },
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
