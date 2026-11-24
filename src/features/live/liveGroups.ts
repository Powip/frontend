import type { LiveCustomer, LiveProduct, LiveReservation } from "./types";

/** FEAT-33 B2: variantes agrupadas por producto, como en Registrar venta. */
export interface LiveProductGroup {
  key: string;
  name: string;
  imageUrl?: string | null;
  regularPrice: number;
  variants: LiveProduct[];
  totalStock: number;
}

export function groupLiveProducts(products: LiveProduct[]): LiveProductGroup[] {
  const groups = new Map<string, LiveProductGroup>();
  for (const item of products) {
    const key = item.productId || item.variantId;
    const group = groups.get(key) ?? {
      key,
      name: item.name,
      imageUrl: item.imageUrl,
      regularPrice: item.regularPrice,
      variants: [],
      totalStock: 0,
    };
    group.variants.push(item);
    group.totalStock += Math.max(0, item.availableStock || 0);
    group.imageUrl ||= item.imageUrl;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export interface LiveVariantMatrix {
  rowLabel: string | null;
  colLabel: string | null;
  rows: string[];
  cols: string[];
  cell: (row: string, col: string) => LiveProduct | undefined;
}

const SIZE = /^(talla|tallas|size|tamaño|medida)$/i;

/** Filas = el resto de atributos (color…), columnas = la talla (o el último atributo). */
export function variantMatrix(variants: LiveProduct[]): LiveVariantMatrix {
  const keys = [
    ...new Set(variants.flatMap((item) => Object.keys(item.attributes ?? {}))),
  ];
  const colLabel =
    keys.find((key) => SIZE.test(key.trim())) ?? keys.at(-1) ?? null;
  const rowKeys = keys.filter((key) => key !== colLabel);
  const rowOf = (item: LiveProduct) =>
    rowKeys
      .map((key) => item.attributes?.[key] ?? "")
      .filter(Boolean)
      .join(" / ");
  const colOf = (item: LiveProduct) =>
    colLabel
      ? (item.attributes?.[colLabel] ?? "")
      : item.variantLabel || item.sku;
  const rows = [...new Set(variants.map(rowOf))];
  const cols = [...new Set(variants.map(colOf))];
  const cells = new Map(
    variants.map((item) => [`${rowOf(item)}\u0000${colOf(item)}`, item]),
  );
  return {
    rowLabel: rowKeys.length ? rowKeys.join(" / ") : null,
    colLabel,
    rows,
    cols,
    cell: (row, col) => cells.get(`${row}\u0000${col}`),
  };
}

/**
 * FEAT-33 A3: pestañas de Apartados.
 * TIMED = con tiempo · TRUSTED = separado sin pagar (clientes de confianza) ·
 * REVIEW = comprobante enviado, pago por validar · PAID = pagados.
 */
export type LiveReservationTab = "TIMED" | "TRUSTED" | "REVIEW" | "PAID";

export const isActiveReservation = (reservation: LiveReservation) =>
  ["PENDING", "ACTIVE", "RELEASING"].includes(reservation.status);

export function reservationTab(
  reservation: LiveReservation,
): LiveReservationTab | null {
  if (reservation.status === "PAID") return "PAID";
  if (!isActiveReservation(reservation)) return null;
  if (reservation.reviewHold) return "REVIEW";
  return reservation.type === "ACCUMULATED" ? "TRUSTED" : "TIMED";
}

export interface LiveReservationGroup {
  key: string;
  customer: LiveCustomer;
  items: LiveReservation[];
  units: number;
  total: number;
  /** El apartado que vence primero: la tarjeta muestra un solo reloj. */
  timer: LiveReservation | null;
}

export function groupReservations(
  reservations: LiveReservation[],
  tab: LiveReservationTab,
): LiveReservationGroup[] {
  const groups = new Map<string, LiveReservationGroup>();
  for (const item of reservations) {
    if (reservationTab(item) !== tab) continue;
    const key = `${item.customer.id ?? item.id}|${item.ownerId ?? "store"}`;
    const group = groups.get(key) ?? {
      key,
      customer: item.customer,
      items: [],
      units: 0,
      total: 0,
      timer: null,
    };
    group.items.push(item);
    // FEAT-33 L7b: el regalo de una promo del live no es una unidad comprada (vale S/ 0).
    if (!item.isGift) group.units += item.quantity;
    group.total += item.quantity * item.unitPrice;
    if (
      item.expiresAt &&
      (!group.timer?.expiresAt ||
        Date.parse(item.expiresAt) < Date.parse(group.timer.expiresAt))
    )
      group.timer = item;
    groups.set(key, group);
  }
  return [...groups.values()];
}
