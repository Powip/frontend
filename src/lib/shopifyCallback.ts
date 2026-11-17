/**
 * FEAT-24 H1-D (R10): el backend ya no manda el access token de Shopify en la
 * URL del callback; avisa con `status=connected` (y por un tiempo también
 * `token=connected`, un marcador sin valor real). Se acepta cualquiera de los
 * dos para no romper con un backend todavía viejo.
 */
export function isConnectedCallback(params: Pick<URLSearchParams, "get">): boolean {
  return params.get("status") === "connected" || Boolean(params.get("token"));
}
