/**
 * Canales de venta tal como llegan en los pedidos.
 *
 * `salesChannel` es texto libre en ms-ventas: el tipo de canal de la tienda en las ventas manuales, `WEB` en
 * Shopify, `EXTERNO` en los borradores, `LIVE TIKTOK` / `TIKTOK_LIVE` en Live… El módulo ya no usa una lista
 * fija: agrupa las grafías de un mismo canal (`claveCanal`) y lista los canales que aparecen en los datos.
 */

export type GrupoCanal = "directo" | "marketplace";

const ALIAS: Record<string, string> = {
  LIVE_TIKTOK: "TIKTOK_LIVE",
  TIKTOKLIVE: "TIKTOK_LIVE",
  TIK_TOK_LIVE: "TIKTOK_LIVE",
  TIK_TOK: "TIKTOK",
  MERCADO_LIBRE: "MERCADOLIBRE",
  MERCADOLIBRE_PE: "MERCADOLIBRE",
  SHOPIFY: "WEB",
  WHATS_APP: "WHATSAPP",
  WSP: "WHATSAPP",
  TIENDA: "TIENDA_FISICA",
};

const NOMBRES: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  WEB: "Web / Shopify",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  TIKTOK_LIVE: "TikTok Live",
  POWIP_LIVE: "Live Powip",
  FALABELLA: "Falabella",
  RIPLEY: "Ripley",
  RAPPI: "Rappi",
  MERCADOLIBRE: "Mercado Libre",
  MARKETPLACE: "Marketplace",
  TIENDA_FISICA: "Tienda física",
  RECOMPRA: "Recompra",
  RECOMENDADO: "Recomendado",
  EXTERNO: "Externo",
  OTRO: "Otro",
  SIN_CANAL: "Sin canal",
};

const MARKETPLACES = new Set(["FALABELLA", "RIPLEY", "RAPPI", "MERCADOLIBRE", "MARKETPLACE"]);

/** Clave estable de un canal: mayúsculas, sin tildes, palabras unidas por «_» y grafías agrupadas. */
export function claveCanal(raw: string | null | undefined): string {
  const limpio = (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!limpio) return "SIN_CANAL";
  return ALIAS[limpio] ?? limpio;
}

export function nombreCanal(clave: string): string {
  if (NOMBRES[clave]) return NOMBRES[clave];
  return clave
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((palabra) => palabra[0].toUpperCase() + palabra.slice(1))
    .join(" ");
}

export function grupoCanal(clave: string): GrupoCanal {
  return MARKETPLACES.has(clave) ? "marketplace" : "directo";
}

export function canalDePedido(pedido: { salesChannel?: string | null }): string {
  return claveCanal(pedido.salesChannel);
}

export interface CanalEnDatos {
  clave: string;
  nombre: string;
  grupo: GrupoCanal;
  /** Grafías crudas vistas, de la más usada a la menos usada. */
  grafias: string[];
  pedidos: number;
}

/** Canales presentes en una lista de pedidos, del que más pedidos tiene al que menos. */
export function canalesEnDatos(pedidos: { salesChannel?: string | null }[]): CanalEnDatos[] {
  const mapa = new Map<string, { pedidos: number; grafias: Map<string, number> }>();
  for (const pedido of pedidos ?? []) {
    const clave = canalDePedido(pedido);
    const crudo = (pedido.salesChannel ?? "").trim();
    const actual = mapa.get(clave) ?? { pedidos: 0, grafias: new Map<string, number>() };
    actual.pedidos += 1;
    if (crudo) actual.grafias.set(crudo, (actual.grafias.get(crudo) ?? 0) + 1);
    mapa.set(clave, actual);
  }
  return [...mapa.entries()]
    .map(([clave, { pedidos: n, grafias }]) => ({
      clave,
      nombre: nombreCanal(clave),
      grupo: grupoCanal(clave),
      grafias: [...grafias.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g),
      pedidos: n,
    }))
    .sort((a, b) => b.pedidos - a.pedidos || a.nombre.localeCompare(b.nombre));
}
