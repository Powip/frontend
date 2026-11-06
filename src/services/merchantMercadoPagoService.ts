import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { MERCHANT_MP_UUID, merchantMercadoPagoAuthorizationUrl } from "@/lib/merchantMercadoPago";

export interface MerchantMercadoPagoConnection {
  connected: boolean;
  mode: "test" | "production";
  collectorId?: string;
  accountLabel?: string;
  canManage: boolean;
  oauthReady: boolean;
  revocationRequired?: boolean;
  connectionType?: "oauth";
}

const salesBase = () => (process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas).replace(/\/+$/, "");
function connectionPath(storeId: string) {
  if (!MERCHANT_MP_UUID.test(storeId)) throw new Error("Selecciona una tienda válida.");
  return `/merchant-payments/stores/${storeId}/mercadopago`;
}
const options = (token: string, signal: AbortSignal) => ({
  headers: { Authorization: `Bearer ${token}` },
  signal,
  timeout: 12_000,
});

export async function getMerchantMercadoPagoConnection(
  storeId: string,
  token: string,
  signal: AbortSignal,
): Promise<MerchantMercadoPagoConnection> {
  const { data } = await axiosAuth.get<MerchantMercadoPagoConnection>(
    `${salesBase()}${connectionPath(storeId)}/connection`,
    options(token, signal),
  );
  if (
    !data ||
    typeof data.connected !== "boolean" ||
    typeof data.canManage !== "boolean" ||
    typeof data.oauthReady !== "boolean" ||
    !["production", "test"].includes(data.mode) ||
    (data.collectorId !== undefined &&
      (typeof data.collectorId !== "string" || !/^\d{1,30}$/.test(data.collectorId))) ||
    (data.connected && (!data.collectorId || data.connectionType !== "oauth")) ||
    (data.accountLabel !== undefined &&
      (typeof data.accountLabel !== "string" || data.accountLabel.length > 100))
  )
    throw new Error("Estado de conexión no disponible.");
  return {
    connected: data.connected,
    canManage: data.canManage,
    oauthReady: data.oauthReady,
    mode: data.mode,
    collectorId: data.collectorId,
    accountLabel: data.accountLabel,
    revocationRequired: data.revocationRequired === true,
    connectionType: data.connectionType === "oauth" ? "oauth" : undefined,
  };
}

export async function connectMerchantMercadoPago(
  storeId: string,
  token: string,
  signal: AbortSignal,
): Promise<string> {
  const { data } = await axiosAuth.post<{ authorizationUrl: string }>(
    `/api${connectionPath(storeId)}/connect`,
    { mode: "production" },
    { ...options(token, signal), withCredentials: true },
  );
  const url = merchantMercadoPagoAuthorizationUrl(data?.authorizationUrl);
  if (!url) throw new Error("Autorización de Mercado Pago no válida.");
  return url;
}

export function openMerchantMercadoPagoAuthorization(url: string) {
  const safeUrl = merchantMercadoPagoAuthorizationUrl(url);
  if (!safeUrl) throw new Error("Autorización de Mercado Pago no válida.");
  window.location.assign(safeUrl);
}

export async function disconnectMerchantMercadoPago(
  storeId: string,
  token: string,
  signal: AbortSignal,
): Promise<void> {
  await axiosAuth.post(
    `${salesBase()}${connectionPath(storeId)}/disconnect`,
    {},
    options(token, signal),
  );
}

export function merchantMercadoPagoError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) return "Tu sesión venció. Inicia sesión nuevamente.";
  if (status === 403) return "Solo el administrador de la empresa puede gestionar esta conexión.";
  if (status === 404) return "La conexión de Mercado Pago no está disponible para esta tienda.";
  if (status === 429) return "Hay demasiados intentos. Espera unos minutos y vuelve a intentar.";
  if (status === 503)
    return "La conexión de Mercado Pago aún no está disponible. Intenta más tarde.";
  return "No pudimos consultar o actualizar la conexión. Vuelve a intentar.";
}
