/**
 * FEAT-24 H9 (H9-D5/D6) — canales reales del pedido (`salesChannel` de ms-ventas) para promociones y listas
 * de precios. Ya no hay canales fijos como Rappi o Pedidos Ya; un SHOPIFY viejo se toma como WEB.
 */
export const ORDER_CHANNELS = [
  { value: "TIENDA_FISICA", label: "Tienda física" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "MERCADOLIBRE", label: "Mercado Libre" },
  { value: "WEB", label: "Web / Shopify" },
  { value: "SHEETS", label: "Google Sheets" },
  { value: "OTRO", label: "Otro" },
] as const;

export type OrderChannel = (typeof ORDER_CHANNELS)[number]["value"];

/** FEAT-32 M2 — canales de POWIP (listas de precios por canal); no son canales de venta del pedido. */
export const POWIP_PRICE_CHANNELS = [
  { value: "POWIP_CRM", label: "POWIP CRM" },
  { value: "CATALOGO_WEB", label: "Catálogo web" },
] as const;

/** FEAT-32 M4 — canal POWIP Live: no entra en las campañas (tiene su precio live), sí en volumen y regalo (spec §6.15). */
export const POWIP_LIVE_CHANNEL = { value: "POWIP_LIVE", label: "POWIP Live" } as const;

/**
 * FEAT-32 M4 (spec §6.19) — una sola lista de canales: la misma que la campaña (canales de POWIP y del pedido)
 * más POWIP Live, que en volumen y regalo aplica solo si se elige.
 */
export const VOLUME_GIFT_CHANNELS: Array<{ value: string; label: string }> = [POWIP_LIVE_CHANNEL, ...POWIP_PRICE_CHANNELS, ...ORDER_CHANNELS].map(
  (channel) => ({ value: channel.value, label: channel.label }),
);

const LABELS: Record<string, string> = Object.fromEntries(
  [...ORDER_CHANNELS, ...POWIP_PRICE_CHANNELS, POWIP_LIVE_CHANNEL].map((channel) => [channel.value, channel.label]),
);

/** Código en mayúsculas; SHOPIFY (viejo) cuenta como WEB, igual que el backend. */
export function normalizeOrderChannel(channel: string | null | undefined): string | null {
  const code = String(channel ?? "").trim().toUpperCase();
  if (!code) return null;
  return code === "SHOPIFY" ? "WEB" : code;
}

export function channelLabel(channel: string | null | undefined): string {
  const code = normalizeOrderChannel(channel);
  if (!code) return "Todos los canales";
  return LABELS[code] ?? code.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** ¿Una regla con estos canales aplica al canal del pedido? Vacío = todos los canales. */
export function channelMatches(channels: readonly string[], channel: string | null | undefined): boolean {
  if (channels.length === 0) return true;
  const code = normalizeOrderChannel(channel);
  if (!code) return true;
  return channels.some((item) => normalizeOrderChannel(item) === code);
}
