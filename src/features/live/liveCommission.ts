import type { LiveAgreement } from "./types";

/**
 * FEAT-33 C1: textos y ejemplo del acuerdo de comisión (mismo cálculo que ms-ventas `live-commission.ts`:
 * por línea, en céntimos, sin envío).
 */
export type AgreementKind = LiveAgreement["type"];
export const AGREEMENT_KINDS: { type: AgreementKind; label: string; hint: string }[] = [
  { type: "PERCENT", label: "% sobre la venta", hint: "Ej. 10% de lo que pagó el cliente" },
  { type: "PER_UNIT", label: "Monto fijo por prenda", hint: "Ej. S/ 5 por cada unidad" },
  { type: "RESELLER", label: "Precio de revendedora", hint: "Gana la diferencia entre su precio y el de venta" },
  { type: "VOLUME", label: "Por volumen", hint: "Sube el % según cuántas prendas vende" },
];
export const DEFAULT_TIERS = [
  { from: 0, percent: 8 },
  { from: 20, percent: 10 },
  { from: 50, percent: 12 },
];

const soles = (n: number) => `S/ ${(Math.round(n * 100) / 100).toFixed(2)}`;
const num = (n: number) => String(Math.round(n * 100) / 100);

export function agreementText(agreement: LiveAgreement, short = false): string {
  switch (agreement.type) {
    case "PERCENT":
      return `${num(agreement.percent)}% sobre la venta`;
    case "PER_UNIT":
      return `${soles(agreement.amount)} por prenda`;
    case "RESELLER":
      return short
        ? `Revendedora (${num(agreement.percent)}% bajo tienda)`
        : `Precio de revendedora: ${num(agreement.percent)}% bajo el precio de tienda; gana la diferencia con lo que pagó el cliente`;
    case "VOLUME": {
      const tiers = agreement.tiers;
      if (short) return `Por volumen (${tiers.map((t) => `${num(t.percent)}%`).join(" · ")})`;
      return `Por volumen: ${tiers
        .map((t, i) => `${t.from}${tiers[i + 1] ? `–${tiers[i + 1].from - 1}` : "+"} prendas ${num(t.percent)}%`)
        .join(" · ")} (por ${agreement.period === "MONTH" ? "mes" : "live"})`;
    }
  }
}

/** Mismo control que el backend (`agreementError`), para mostrar el error debajo del campo. */
export function agreementError(agreement: LiveAgreement): string {
  switch (agreement.type) {
    case "PERCENT":
      return agreement.percent >= 0.1 && agreement.percent <= 100 ? "" : "El porcentaje va de 0.1 a 100.";
    case "PER_UNIT":
      return agreement.amount > 0 ? "" : "El monto por prenda tiene que ser mayor a 0.";
    case "RESELLER":
      return agreement.percent >= 0.1 && agreement.percent <= 99 ? "" : "El descuento de revendedora va de 0.1 a 99.";
    case "VOLUME": {
      const tiers = agreement.tiers;
      if (!tiers.length) return "Agrega al menos una escala.";
      if (tiers[0].from !== 0) return "La primera escala empieza en 0 prendas.";
      for (let i = 1; i < tiers.length; i++)
        if (!(tiers[i].from > tiers[i - 1].from)) return "Cada escala empieza en más prendas que la anterior.";
      if (tiers.some((t) => !(t.percent >= 0 && t.percent <= 100))) return "El porcentaje de cada escala va de 0 a 100.";
      return "";
    }
  }
}

/** Ejemplo en números reales con un producto del live (precio de tienda y precio live). */
export function agreementExample(
  agreement: LiveAgreement,
  product: { name: string; regularPrice: number; livePrice: number } | null,
): string {
  if (agreement.type === "PER_UNIT")
    return `Gana ${soles(agreement.amount || 0)} por cada prenda, sin importar el precio.`;
  if (agreement.type === "VOLUME") {
    const last = agreement.tiers[agreement.tiers.length - 1];
    return last
      ? `Al llegar a ${last.from} prendas ${agreement.period === "MONTH" ? "en el mes" : "en el live"} su % sube a ${num(last.percent)}%.`
      : "";
  }
  if (!product) return "";
  const live = product.livePrice;
  if (agreement.type === "PERCENT")
    return `Si vende 1 ${product.name} a ${soles(live)} gana ${soles((live * (agreement.percent || 0)) / 100)}.`;
  const own = Math.round(product.regularPrice * (100 - (agreement.percent || 0))) / 100;
  return `Ella tiene ${product.name} a ${soles(own)}: si lo vende a ${soles(product.regularPrice)} gana ${soles(
    Math.max(0, product.regularPrice - own),
  )}; a precio live (${soles(live)}) gana ${soles(Math.max(0, live - own))}.`;
}
