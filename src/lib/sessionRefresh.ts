import axios from "axios";
import { type SessionSnapshot, tokenStore } from "./tokenStore";

let refresher: (() => Promise<boolean>) | null = null;
let pending: {
  epoch: number;
  controller: AbortController;
  promise: Promise<string | null>;
} | null = null;

export function registerSessionRefresher(callback: () => Promise<boolean>) {
  refresher = callback;
  return () => {
    if (refresher === callback) refresher = null;
  };
}

export function cancelSessionRefresh() {
  pending?.controller.abort();
  pending = null;
}

// Both public profile refresh and automatic 401 recovery share cookie rotation.
// Use plain axios so this endpoint can never recursively renew itself.
export function requestSessionToken(session: SessionSnapshot): Promise<string | null> {
  if (!tokenStore.isCurrent(session)) return Promise.resolve(null);
  if (pending?.epoch === session.epoch) return pending.promise;
  cancelSessionRefresh();
  const controller = new AbortController();
  const request = {
    epoch: session.epoch,
    controller,
    promise: Promise.resolve<string | null>(null),
  };
  pending = request;
  request.promise = (async () => {
    try {
      const response = await axios.post(
        "/api/auth/refresh",
        {},
        { withCredentials: true, signal: controller.signal },
      );
      const token: unknown = response.data?.accessToken;
      return !controller.signal.aborted &&
        tokenStore.isCurrent(session) &&
        typeof token === "string"
        ? token
        : null;
    } catch {
      return null;
    } finally {
      if (pending === request) pending = null;
    }
  })();
  return request.promise;
}

export async function renewCurrentSession(session: SessionSnapshot): Promise<boolean> {
  if (!session.active || !session.token || !tokenStore.isCurrent(session) || !refresher)
    return false;
  try {
    return await refresher();
  } catch {
    return false;
  }
}
