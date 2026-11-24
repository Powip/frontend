import axios from "axios";
import { GATEWAY } from "@/lib/gateway";
import type {
  LiveSellerPortalMe,
  LiveSellerPortalProduct,
  LiveSellerPortalSales,
  LiveSellerPortalSession,
  LiveAgreement,
} from "./types";

/**
 * FEAT-33 L5b: API del portal de la creadora. No usa la sesión de Powip: manda su propia sesión en
 * `X-Live-Seller-Session` y nunca cookies.
 */
const portalPath = (slug: string) => `${GATEWAY.ventas}/live/portal/${encodeURIComponent(slug)}`;
const options = (session?: string) => ({
  timeout: 20000,
  withCredentials: false,
  headers: session ? { "X-Live-Seller-Session": session } : {},
});
const storageKey = (slug: string) => `powip-live-seller:${slug}`;

export function readPortalSession(slug: string): string | null {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { token?: string; expiresAt?: string };
    if (!saved.token || !saved.expiresAt || Date.parse(saved.expiresAt) <= Date.now()) return null;
    return saved.token;
  } catch {
    return null;
  }
}
export function savePortalSession(slug: string, session: LiveSellerPortalSession | null) {
  try {
    if (session)
      window.localStorage.setItem(storageKey(slug), JSON.stringify({ token: session.token, expiresAt: session.expiresAt }));
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    /* sin almacenamiento: la sesión dura lo que la pestaña */
  }
}

export async function portalLogin(slug: string, email: string, password: string) {
  return (await axios.post<LiveSellerPortalSession>(`${portalPath(slug)}/login`, { email, password }, options())).data;
}
export async function portalLinkInfo(slug: string, token: string) {
  return (
    await axios.post<{ name: string; email: string | null; kind: "INVITE" | "RESET"; storeName: string }>(
      `${portalPath(slug)}/link`,
      { token },
      options(),
    )
  ).data;
}
export async function portalSetPassword(slug: string, token: string, password: string) {
  return (await axios.post<LiveSellerPortalSession>(`${portalPath(slug)}/password`, { token, password }, options())).data;
}
export async function portalLogout(slug: string, session: string) {
  await axios.post(`${portalPath(slug)}/logout`, {}, options(session));
}
export async function portalMe(slug: string, session: string) {
  return (await axios.get<LiveSellerPortalMe>(`${portalPath(slug)}/me`, options(session))).data;
}
export async function portalProducts(slug: string, session: string) {
  return (
    await axios.get<{ agreement: LiveAgreement; products: LiveSellerPortalProduct[] }>(
      `${portalPath(slug)}/products`,
      options(session),
    )
  ).data;
}
export async function portalSales(slug: string, session: string) {
  return (await axios.get<LiveSellerPortalSales>(`${portalPath(slug)}/sales`, options(session))).data;
}
export function portalStatus(error: unknown): number | null {
  return axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
}

/** Ganancia por unidad que ve la creadora (igual que el mockup: volumen con la primera escala). */
export function gainPerUnit(agreement: LiveAgreement, product: { livePrice: number; regularPrice: number }) {
  const round = (n: number) => Math.round(n * 100) / 100;
  switch (agreement.type) {
    case "PERCENT":
      return round((product.livePrice * agreement.percent) / 100);
    case "PER_UNIT":
      return round(agreement.amount);
    case "RESELLER":
      return round(Math.max(0, product.livePrice - Math.round(product.regularPrice * (100 - agreement.percent)) / 100));
    case "VOLUME":
      return round((product.livePrice * (agreement.tiers[0]?.percent ?? 0)) / 100);
  }
}
