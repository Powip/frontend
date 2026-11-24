/**
 * FEAT-33 A12 / D1: el único lugar que arma los links públicos del live.
 * - Negocio: `…/live/{tienda}` (o `{tienda}.powip.lat/live` cuando el DNS comodín esté listo).
 * - Asesora o creadora: el mismo link con `?a=CÓDIGO` (POWIP Link, precio normal).
 * - Vendedor por comisión dentro del live: `?v=CÓDIGO`.
 * - Portal de creadoras (L5b): `…/vendedor/{tienda}` (o `{tienda}.powip.lat/vendedor`); el enlace de acceso lleva
 *   el token en el fragmento (`#t=`), que el navegador nunca manda al servidor.
 * El subdominio se activa con NEXT_PUBLIC_LIVE_SUBDOMAIN=powip.lat (o si la app ya corre en *.powip.lat).
 */
export interface LiveLinks {
  publicUrl: string;
  displayUrl: string;
  advisorUrl: (code: string) => string;
  sellerUrl: (code: string) => string;
  portalUrl: string;
  portalAccessUrl: (token: string) => string;
}

export function liveLinks({
  origin,
  slug,
  storeId,
  subdomainBase = process.env.NEXT_PUBLIC_LIVE_SUBDOMAIN,
}: {
  origin: string;
  slug?: string | null;
  storeId?: string | null;
  subdomainBase?: string | null;
}): LiveLinks {
  const name = slug?.trim() || "";
  const host = origin ? safeHost(origin) : "";
  const base = subdomainBase?.trim() || (host === "powip.lat" || host.endsWith(".powip.lat") ? "powip.lat" : "");
  const publicUrl = !origin
    ? ""
    : name && base
      ? `https://${name}.${base}/live`
      : name
        ? `${origin}/live/${encodeURIComponent(name)}`
        : storeId
          ? `${origin}/live/${encodeURIComponent(storeId)}`
          : "";
  const withCode = (key: "a" | "v") => (code: string) =>
    publicUrl ? `${publicUrl}?${key}=${encodeURIComponent(code)}` : "";
  const portalUrl = !origin || !name ? "" : base ? `https://${name}.${base}/vendedor` : `${origin}/vendedor/${encodeURIComponent(name)}`;
  return {
    publicUrl,
    displayUrl: publicUrl.replace(/^https?:\/\//, ""),
    advisorUrl: withCode("a"),
    sellerUrl: withCode("v"),
    portalUrl,
    portalAccessUrl: (token: string) => (portalUrl ? `${portalUrl}#t=${token}` : ""),
  };
}

function safeHost(origin: string) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}
