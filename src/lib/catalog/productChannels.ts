/**
 * FEAT-32 M2 — canales de POWIP y regla de precio por canal (spec v1.2 §6.2, §6.7, §6.8, §7.1, §7.8, §7.10).
 * Copia de las reglas puras de ms-products (`src/product-channels/channel-rules.ts`): la vista previa de la
 * ventana de precio tiene que dar lo mismo que el servidor.
 */

export const RULE_CHANNELS = ["POWIP_CRM", "CATALOGO_WEB"] as const;
export type RuleChannel = (typeof RULE_CHANNELS)[number];

export interface PowipChannelMeta {
  code: "POWIP_LIVE" | RuleChannel;
  name: string;
  short: string;
  /** Lo que muestra el canal (columna «Qué muestra»). */
  shows: string;
  showsHint?: string;
  /** Color del ícono (mockup: Live verde agua, CRM morado, Catálogo verde agua oscuro). */
  color: string;
}

export const POWIP_CHANNELS: PowipChannelMeta[] = [
  { code: "POWIP_LIVE", name: "POWIP Live", short: "LIVE", shows: "Hasta 3 fotos elegidas", showsHint: "Se agrega y se edita en POWIP Live › Productos del live", color: "#027778" },
  { code: "POWIP_CRM", name: "POWIP CRM", short: "CRM", shows: "Todo el contenido, al instante", color: "#4C2FB5" },
  { code: "CATALOGO_WEB", name: "Catálogo web", short: "WEB", shows: "Todo el contenido, al instante", color: "#015d5e" },
];

export const channelName = (code: string): string => POWIP_CHANNELS.find((channel) => channel.code === code)?.name ?? code;

export const isRuleChannel = (code: string | null | undefined): code is RuleChannel =>
  !!code && (RULE_CHANNELS as readonly string[]).includes(code);

export type RuleMode = "same" | "more" | "less" | "fixed";
export type RuleUnit = "percent" | "amount";

export interface PriceRule {
  mode: RuleMode;
  unit?: RuleUnit | null;
  value?: number | null;
}

export const SAME_RULE: PriceRule = { mode: "same", unit: null, value: null };
export const IGV_RATE = 0.18;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export function applyRule(base: number, rule: PriceRule): number {
  const value = Number(rule.value ?? 0);
  switch (rule.mode) {
    case "fixed":
      return round2(value);
    case "more":
    case "less": {
      const delta = rule.unit === "percent" ? (base * value) / 100 : value;
      return round2(rule.mode === "more" ? base + delta : base - delta);
    }
    default:
      return round2(base);
  }
}

/** Mensaje de la spec si la regla no sirve; `null` si está bien. */
export function ruleProblem(rule: PriceRule): string | null {
  if (rule.mode === "same") return null;
  const value = rule.value === null || rule.value === undefined ? NaN : Number(rule.value);
  if (!Number.isFinite(value) || round2(value) <= 0) return "Escribe un valor mayor a 0.";
  if (rule.mode === "fixed") return null;
  if (!rule.unit) return "Elige si el valor es en % o en S/.";
  if (rule.mode === "less" && rule.unit === "percent" && round2(value) >= 100) return "El descuento debe ser menor a 100%.";
  return null;
}

/** Igual que el servidor: precio ≤ 0 en alguna variante (sin precio propio) → error. */
export function rulePricesProblem(rule: PriceRule, storePrices: number[]): string | null {
  const problem = ruleProblem(rule);
  if (problem) return problem;
  if (rule.mode !== "same" && storePrices.some((price) => applyRule(price, rule) <= 0)) return "El precio quedaría en cero o negativo.";
  return null;
}

const soles = (value: number) => `S/ ${round2(value).toFixed(2)}`;
const percent = (value: number) => `${Number.isInteger(round2(value)) ? round2(value) : round2(value).toFixed(2)}%`;

export function ruleLabel(rule: PriceRule): string {
  const value = Number(rule.value ?? 0);
  const amount = rule.unit === "percent" ? percent(value) : soles(value);
  switch (rule.mode) {
    case "more":
      return `Tienda + ${amount}`;
    case "less":
      return `Tienda − ${amount}`;
    case "fixed":
      return `Precio fijo ${soles(value)}`;
    default:
      return "Igual al de tienda";
  }
}

/** ¿Precio (con IGV) bajo el costo (sin IGV)? Sin costo no se avisa. */
export function belowCost(price: number, cost: number | null | undefined, igvIncluded = true): boolean {
  if (cost === null || cost === undefined || !Number.isFinite(cost) || cost <= 0) return false;
  return round2(igvIncluded ? price / (1 + IGV_RATE) : price) < round2(cost);
}

/** «S/ 149.00» o «S/ 129.00 – S/ 159.00» si las variantes tienen precios distintos. */
export function priceRange(prices: number[]): string {
  if (!prices.length) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? soles(min) : `${soles(min)} – ${soles(max)}`;
}

/** Texto del campo de valor de la ventana de precio → número (acepta coma decimal). */
export function parseRuleValue(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------------------------------------------
// Lista de productos (§7.1): estado de cada canal de POWIP y «Varía por canal».

export interface ChannelSummary {
  channels: Array<{ productId: string; storeId: string; channel: string; active: boolean; ruleMode: string }>;
  ownPrices: Array<{ productId: string; storeId: string }>;
}

export type ChannelState = "al_dia" | "no_activado";

export interface ProductChannelStates {
  /** Por canal con regla: activo en alguna tienda del alcance = «Al día». */
  states: Record<RuleChannel, ChannelState>;
  /** Alguna tienda del alcance tiene una regla ≠ «igual» activa o un precio propio por canal. */
  variesByChannel: boolean;
}

/**
 * Estados del producto en los canales de POWIP para las tiendas del alcance. Sin fila = activo con «igual»
 * (el producto nace activo). `storeIds` vacío = todas las tiendas que se conocen.
 */
export function productChannelStates(summary: ChannelSummary | undefined, productId: string, storeIds: string[]): ProductChannelStates {
  const inScope = (storeId: string) => storeIds.length === 0 || storeIds.includes(storeId);
  const rows = (summary?.channels ?? []).filter((row) => row.productId === productId && inScope(row.storeId));
  const states = {} as Record<RuleChannel, ChannelState>;
  for (const channel of RULE_CHANNELS) {
    const own = rows.filter((row) => row.channel === channel);
    const stores = storeIds.length ? storeIds : [...new Set(own.map((row) => row.storeId))];
    // Una tienda sin fila está activa; si todas las del alcance lo desactivaron, «No activado».
    const allOff = own.length > 0 && stores.every((storeId) => own.some((row) => row.storeId === storeId && !row.active));
    states[channel] = allOff ? "no_activado" : "al_dia";
  }
  const variesByChannel =
    rows.some((row) => row.active && row.ruleMode !== "same") ||
    (summary?.ownPrices ?? []).some((row) => row.productId === productId && inScope(row.storeId));
  return { states, variesByChannel };
}

export const CHANNEL_STATE_LABEL: Record<ChannelState, string> = { al_dia: "Al día", no_activado: "No activado" };
