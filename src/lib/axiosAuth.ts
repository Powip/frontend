import axios, { CanceledError, type InternalAxiosRequestConfig } from "axios";
import { renewCurrentSession } from "./sessionRefresh";
import { type SessionSnapshot, tokenStore } from "./tokenStore";

interface SessionRequestConfig extends InternalAxiosRequestConfig {
  _authSession?: SessionSnapshot;
  _authRetried?: boolean;
}

const axiosAuth = axios.create();

axiosAuth.interceptors.request.use((config: SessionRequestConfig) => {
  if (config._authRetried && config._authSession && !tokenStore.isCurrent(config._authSession)) {
    throw new CanceledError("La sesión cambió antes de reintentar la solicitud.");
  }
  const session = tokenStore.snapshot();
  if (
    session.token &&
    !session.active &&
    (!config.headers.has("Authorization") ||
      config.headers.get("Authorization") === `Bearer ${session.token}`)
  ) {
    throw new CanceledError(
      "La sesión está cambiando. Reintenta cuando termine de iniciar sesión.",
    );
  }
  if (session.token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${session.token}`);
  }
  const managed =
    session.active &&
    session.token &&
    config.headers.get("Authorization") === `Bearer ${session.token}`;
  if (!config._authRetried) config._authSession = managed ? session : undefined;
  return config;
});

axiosAuth.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
  const config = error.config as SessionRequestConfig | undefined;
  const session = config?._authSession;
  if (
    !config ||
    !session ||
    config._authRetried ||
    config.signal?.aborted ||
    /(?:^|\/)auth(?:\/|$)/i.test(config.url ?? "") ||
    !tokenStore.isCurrent(session)
  )
    throw error;

  config._authRetried = true;
  if (tokenStore.get() === session.token) {
    const renewed = await renewCurrentSession(session);
    if (!renewed && tokenStore.get() === session.token) throw error;
  }
  const renewed = tokenStore.snapshot();
  if (
    !renewed.active ||
    !renewed.token ||
    !tokenStore.isCurrent(session) ||
    config.signal?.aborted
  ) {
    throw error;
  }
  config.headers.set("Authorization", `Bearer ${renewed.token}`);
  return axiosAuth.request(config);
});

export default axiosAuth;
