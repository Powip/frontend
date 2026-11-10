export const MERCHANT_MP_RETURN_PATH = "/configuracion/integraciones/mercadopago";
export const MERCHANT_MP_UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const MERCHANT_MP_STATE = /^[A-Za-z0-9_-]{43}$/;

/** The browser may open only Mercado Pago's authorization page. */
export function merchantMercadoPagoAuthorizationUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const url = new URL(value);
    if (
      url.origin !== "https://auth.mercadopago.com" ||
      url.pathname !== "/authorization" ||
      url.username ||
      url.password ||
      url.hash ||
      url.searchParams.getAll("state").length !== 1 ||
      !MERCHANT_MP_STATE.test(url.searchParams.get("state") || "")
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
