import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  LiveCheckout,
  LiveConfig,
  LiveConsoleData,
  LiveCustomer,
  LiveProduct,
  LivePublicData,
  LivePurchaseInput,
  LiveQuote,
  LiveQuoteInput,
  LiveReservation,
  LiveSession,
} from "./types";

const BASE = `${GATEWAY.ventas}/live`;
const adminPath = (storeId: string) => `${BASE}/stores/${encodeURIComponent(storeId)}`;
const publicPath = (storeId: string) => `${BASE}/public/${encodeURIComponent(storeId)}`;
const anonymousOptions = (visitor: string) => ({
  withCredentials: false,
  headers: { "X-Live-Visitor": visitor },
});

/** An anonymous device credential; it is never a phone number or a customer ID. */
export function liveVisitorToken(storeId: string): string {
  const key = `powip:live:visitor:v1:${storeId}`;
  const access = new URLSearchParams(window.location.hash.slice(1)).get("access");
  const imported = access && /^[A-Za-z0-9_-]{43}$/.test(access) ? access : null;
  if (access)
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  try {
    if (imported) {
      localStorage.setItem(key, imported);
      return imported;
    }
    const token = localStorage.getItem(key);
    if (token && (/^[a-f0-9-]{36}$/.test(token) || /^[A-Za-z0-9_-]{43}$/.test(token))) return token;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return imported ?? crypto.randomUUID();
  }
}
export async function getLiveConsole(storeId: string) {
  return (
    await axiosAuth.get<LiveConsoleData | import("./types").LiveReviewConsoleData>(
      `${adminPath(storeId)}/console`,
    )
  ).data;
}
export async function getLiveCatalog(storeId: string, search = "", signal?: AbortSignal) {
  return (
    await axiosAuth.get<{ products: LiveProduct[]; serverNow: string }>(
      `${adminPath(storeId)}/catalog`,
      { params: { search }, signal },
    )
  ).data;
}
export async function updateLiveConfig(storeId: string, input: Partial<LiveConfig>) {
  return (
    await axiosAuth.patch<{ config: LiveConfig; serverNow: string }>(
      `${adminPath(storeId)}/config`,
      input,
    )
  ).data;
}
export async function updateLiveSession(storeId: string, input: Partial<LiveSession>) {
  return (
    await axiosAuth.patch<{ session: LiveSession; serverNow: string }>(
      `${adminPath(storeId)}/session`,
      input,
    )
  ).data;
}
export async function updateLiveProduct(
  storeId: string,
  variantId: string,
  input: Partial<LiveProduct>,
) {
  return (
    await axiosAuth.put<{ products: LiveProduct[]; serverNow: string }>(
      `${adminPath(storeId)}/products/${encodeURIComponent(variantId)}`,
      input,
    )
  ).data;
}
export async function releaseLiveReservation(storeId: string, id: string) {
  await axiosAuth.post(`${adminPath(storeId)}/reservations/${encodeURIComponent(id)}/release`, {});
}
export async function saveLiveTrustedCustomer(storeId: string, clientId: string) {
  await axiosAuth.put(
    `${adminPath(storeId)}/trusted-customers/${encodeURIComponent(clientId)}`,
    {},
  );
}
export async function removeLiveTrustedCustomer(storeId: string, clientId: string) {
  await axiosAuth.delete(`${adminPath(storeId)}/trusted-customers/${encodeURIComponent(clientId)}`);
}
export async function getPublicLive(storeId: string, visitor: string) {
  return (await axios.get<LivePublicData>(publicPath(storeId), anonymousOptions(visitor))).data;
}
export async function reserveLiveProduct(
  storeId: string,
  visitor: string,
  input: { variantId: string; quantity: number; customer: LiveCustomer; idempotencyKey: string },
) {
  return (
    await axios.post<{ reservation: LiveReservation; serverNow: string }>(
      `${publicPath(storeId)}/reservations`,
      input,
      anonymousOptions(visitor),
    )
  ).data;
}
export async function removePublicLiveReservation(storeId: string, visitor: string, id: string) {
  await axios.delete(
    `${publicPath(storeId)}/reservations/${encodeURIComponent(id)}`,
    anonymousOptions(visitor),
  );
}
export async function quoteLivePurchase(storeId: string, visitor: string, input: LiveQuoteInput) {
  const cleaned = cleanPurchase(input);
  const quote: LiveQuoteInput = {
    items: cleaned.items,
    reservationIds: cleaned.reservationIds,
    customer: cleaned.customer,
    delivery: cleaned.delivery,
    receipt: cleaned.receipt,
  };
  return (
    await axios.post<LiveQuote>(`${publicPath(storeId)}/quote`, quote, anonymousOptions(visitor))
  ).data;
}
export async function checkoutLivePurchase(
  storeId: string,
  visitor: string,
  input: LivePurchaseInput,
) {
  return (
    await axios.post<LiveCheckout>(
      `${publicPath(storeId)}/checkout`,
      cleanPurchase(input),
      anonymousOptions(visitor),
    )
  ).data;
}
export const liveMoney = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number(amount) || 0,
  );
export function liveOrderLabel(status?: string | null): string | null {
  const labels: Record<string, string> = {
    INCOMPLETE: "Datos por completar",
    PREVENTA: "Pedido registrado",
    PENDIENTE: "Pedido pendiente",
    PREPARADO: "Pedido preparado",
    LLAMADO: "El negocio está coordinando la entrega",
    ASIGNADO_A_GUIA: "Pedido listo para envío",
    EN_ENVIO: "Pedido en camino",
    ENTREGADO: "Pedido entregado",
    ANULADO: "Pedido anulado",
    PAGADO: "Pedido pagado",
  };
  return status && Object.prototype.hasOwnProperty.call(labels, status) ? labels[status] : null;
}
export function liveError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.code === "CUSTOMER_REVIEW_REQUIRED")
      return "Los datos de esta compra necesitan revisión del negocio. Contacta al negocio antes de pagar; este intento no se puede confirmar todavía.";
    const message: unknown = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message))
      return message.filter((value) => typeof value === "string").join(". ");
    if (error.response?.status === 403) return "No tienes permiso para realizar esta acción.";
    if (!error.response) return "No se pudo conectar. Comprueba tu conexión y vuelve a intentar.";
  }
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación. Intenta nuevamente.";
}

export function liveAdminError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.data?.code === "CUSTOMER_REVIEW_REQUIRED")
    return "Los datos del cliente o de entrega requieren revisión antes de confirmar el pedido. Revisa el caso con el cliente; no apruebes otro pago para resolverlo.";
  return liveError(error);
}
export function isLiveQuoteConflict(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 409 &&
    ["PRICE_CHANGED", "QUOTE_EXPIRED", "QUOTE_MISMATCH"].includes(error.response?.data?.code)
  );
}

export const platformNames = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
} as const;
export function safeLiveUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function createLivePaymentLink(storeId: string, reservationId: string) {
  return (
    await axiosAuth.post<{ url: string; serverNow: string }>(
      `${adminPath(storeId)}/reservations/${encodeURIComponent(reservationId)}/payment-link`,
      {},
    )
  ).data;
}

function cleanPurchase<T extends LiveQuoteInput>(input: T): T {
  return {
    ...input,
    customer: {
      ...input.customer,
      name: input.customer.name.trim(),
      phone: input.customer.phone.replace(/\D/g, ""),
      socialUsername: input.customer.socialUsername?.trim() || undefined,
    },
    delivery: {
      type: input.delivery.type,
      department: input.delivery.department.trim(),
      province: input.delivery.province.trim(),
      district: input.delivery.district.trim(),
      address: input.delivery.address.trim(),
      ...(input.delivery.type === "AGENCY" ? { agency: input.delivery.agency?.trim() } : {}),
    },
    receipt:
      input.receipt.type === "BOLETA"
        ? { type: "BOLETA", dni: input.receipt.dni.trim() }
        : {
            type: "FACTURA",
            ruc: input.receipt.ruc.trim(),
            businessName: input.receipt.businessName.trim(),
          },
  };
}

export async function getLiveYapeConfig(storeId: string) {
  return (
    await axiosAuth.get<{ config: import("./types").LiveYapeConfig; serverNow: string }>(
      `${adminPath(storeId)}/yape`,
    )
  ).data;
}
export async function updateLiveYapeConfig(
  storeId: string,
  input: Omit<import("./types").LiveYapeConfig, "qrUrl">,
) {
  return (
    await axiosAuth.put<{ config: import("./types").LiveYapeConfig; serverNow: string }>(
      `${adminPath(storeId)}/yape`,
      input,
    )
  ).data;
}
export function validateLivePaymentImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024)
    throw new Error("La imagen debe pesar como máximo 5 MB y no estar vacía.");
}
export async function uploadLiveYapeQr(storeId: string, file: File) {
  validateLivePaymentImage(file);
  const body = new FormData();
  body.append("file", file);
  return (
    await axiosAuth.post<{ config: import("./types").LiveYapeConfig; serverNow: string }>(
      `${adminPath(storeId)}/yape/qr`,
      body,
    )
  ).data;
}
export async function removeLiveYapeQr(storeId: string) {
  return (
    await axiosAuth.delete<{ config: import("./types").LiveYapeConfig; serverNow: string }>(
      `${adminPath(storeId)}/yape/qr`,
    )
  ).data;
}
export async function getLiveCheckoutSnapshot(
  storeId: string,
  visitor: string,
  checkoutId: string,
) {
  return (
    await axios.get<import("./types").LiveCheckoutSnapshot>(
      `${publicPath(storeId)}/checkouts/${encodeURIComponent(checkoutId)}`,
      anonymousOptions(visitor),
    )
  ).data;
}
export async function uploadLiveYapeProof(
  storeId: string,
  visitor: string,
  checkoutId: string,
  input: { file: File; operationNumber: string; idempotencyKey: string },
  signal?: AbortSignal,
) {
  validateLivePaymentImage(input.file);
  const body = new FormData();
  body.append("file", input.file);
  body.append("operationNumber", input.operationNumber.trim());
  body.append("idempotencyKey", input.idempotencyKey);
  return (
    await axios.post<import("./types").LiveCheckoutSnapshot>(
      `${publicPath(storeId)}/checkouts/${encodeURIComponent(checkoutId)}/proof`,
      body,
      { ...anonymousOptions(visitor), signal },
    )
  ).data;
}
export async function getLiveYapeReviews(storeId: string) {
  return (
    await axiosAuth.get<{ reviews: import("./types").LiveYapeReview[]; serverNow: string }>(
      `${adminPath(storeId)}/yape/reviews`,
    )
  ).data;
}
export async function getLiveYapeReviewProof(storeId: string, checkoutId: string) {
  return (
    await axiosAuth.get<{ url: string; expiresAt: string }>(
      `${adminPath(storeId)}/yape/reviews/${encodeURIComponent(checkoutId)}/proof`,
    )
  ).data;
}
export async function reviewLiveYapePayment(
  storeId: string,
  checkoutId: string,
  decision: "approve" | "reject",
  input: { operationNumber?: string; reason?: string; idempotencyKey: string },
) {
  return (
    await axiosAuth.post<import("./types").LiveCheckoutSnapshot>(
      `${adminPath(storeId)}/yape/reviews/${encodeURIComponent(checkoutId)}/${decision}`,
      input,
    )
  ).data;
}
