import type { OrderHeader } from "@/interfaces/IOrder";
import type { Courier } from "@/services/courierService";
import type { CourierCollection } from "@/services/courierSettlementsService";

/**
 * «Por liquidar»: lo que cada courier todavía tiene que rendir al negocio.
 *
 * Se calcula en el navegador con datos reales: pedidos ENTREGADO (ms-ventas)
 * menos los cobros ya confirmados en ms-courier. Es una estimación para
 * reclamar y precargar importes; el cobro solo queda registrado cuando
 * Finanzas lo confirma (POST /courier-settlements/.../collections).
 *
 * Esperado del courier = total del pedido − pagos PAID recibidos directo por
 * el negocio. Un pago contraentrega o en efectivo es dinero que cobró el
 * courier en la puerta (aunque esté PAID), así que no se descuenta: en prod
 * (27-11) los EFECTIVO de pedidos entregados son casi todos de Fenix/Shalom y
 * se cargan después de la entrega. POS, Yape, Plin, transferencia, etc. van
 * directo al negocio. Solo cuentan los PAID: un adelanto PENDING (Yape sin
 * verificar) no se resta, igual que el «Por cobrar» de la guía
 * (`guideOrderBalance`), así el courier no queda debiendo de menos.
 */
export const COURIER_HELD_METHODS: ReadonlySet<string> = new Set(["CONTRA_ENTREGA", "CONTRAENTREGA", "EFECTIVO"]);

export type PendingIssue =
  | "COURIER_NOT_REGISTERED"
  | "COURIER_INACTIVE"
  | "COURIER_AMBIGUOUS"
  | "NO_CURRENCY"
  | "INVALID_AMOUNT";

export const pendingIssueLabels: Record<PendingIssue, string> = {
  COURIER_NOT_REGISTERED: "Courier no registrado",
  COURIER_INACTIVE: "Courier inactivo",
  COURIER_AMBIGUOUS: "Nombre de courier repetido",
  NO_CURRENCY: "Pedido sin moneda",
  INVALID_AMOUNT: "Importes por verificar",
};

export const pendingIssueHelp: Record<PendingIssue, string> = {
  COURIER_NOT_REGISTERED:
    "Registra este courier (mismo nombre) en Configuración → Tiendas → Couriers o asígnale un courier registrado al pedido.",
  COURIER_INACTIVE: "El courier del pedido está inactivo o eliminado. Reactívalo o cambia el courier del pedido.",
  COURIER_AMBIGUOUS: "Hay dos couriers activos con este nombre. Deja uno solo o asigna el courier al pedido.",
  NO_CURRENCY: "Corrige la moneda del pedido antes de confirmar el cobro.",
  INVALID_AMOUNT: "El total o los pagos del pedido no tienen un importe válido.",
};

export interface PendingCollection {
  orderId: string;
  orderNumber: string;
  storeName?: string;
  customerName: string;
  /** Nombre a mostrar: el del courier registrado o el texto del pedido. */
  courierLabel: string;
  /** Courier activo que aceptará ms-courier; null si hay un problema. */
  courierId: string | null;
  currency: string | null;
  /** updated_at del pedido: lo más cercano a la fecha de entrega que hay. */
  updatedAt: string | null;
  days: number;
  totalCents: number;
  paidToBusinessCents: number;
  courierHeldPaymentsCents: number;
  expectedCents: number;
  confirmedCents: number;
  pendingCents: number;
  issue: PendingIssue | null;
}

/** Importe a centavos; NaN si no es un número válido. */
export function toCents(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") return Number.NaN;
  if (typeof value === "string" && !value.trim()) return Number.NaN;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export const fromCents = (cents: number) => cents / 100;

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();

/**
 * Misma regla que ms-courier al confirmar: con courierId tiene que existir y
 * estar activo; sin courierId el texto del pedido tiene que coincidir con un
 * único courier activo. null = el pedido no tiene courier (no se liquida).
 */
export function resolveOrderCourier(
  order: Pick<OrderHeader, "courierId" | "courier">,
  couriers: readonly Courier[],
): { courierId: string | null; label: string; issue: PendingIssue | null } | null {
  const text = (order.courier ?? "").trim();
  if (order.courierId) {
    const match = couriers.find((courier) => courier.id === order.courierId);
    if (!match) return { courierId: null, label: text || "Courier sin registrar", issue: "COURIER_INACTIVE" };
    if (match.isActive === false) return { courierId: null, label: match.name, issue: "COURIER_INACTIVE" };
    return { courierId: match.id, label: match.name, issue: null };
  }
  if (!text) return null;
  const matches = couriers.filter(
    (courier) => courier.isActive !== false && normalize(courier.name) === normalize(text),
  );
  if (matches.length === 1) return { courierId: matches[0].id, label: matches[0].name, issue: null };
  return {
    courierId: null,
    label: text,
    issue: matches.length > 1 ? "COURIER_AMBIGUOUS" : "COURIER_NOT_REGISTERED",
  };
}

export function daysSince(date: string | null | undefined, now = Date.now()): number {
  const time = date ? new Date(date).getTime() : Number.NaN;
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 86_400_000)) : 0;
}

export function buildPendingCollections(
  orders: readonly OrderHeader[],
  collections: readonly CourierCollection[],
  couriers: readonly Courier[],
  now = Date.now(),
): PendingCollection[] {
  const confirmed = new Map<string, number>();
  for (const collection of collections) {
    const cents = toCents(collection.amount);
    confirmed.set(collection.orderId, (confirmed.get(collection.orderId) ?? 0) + (Number.isFinite(cents) ? cents : 0));
  }
  const rows: PendingCollection[] = [];
  for (const order of orders) {
    if (order.status !== "ENTREGADO") continue;
    const courier = resolveOrderCourier(order, couriers);
    if (!courier) continue;
    const totalCents = toCents(order.grandTotal);
    let paidToBusinessCents = Array.isArray(order.payments) ? 0 : Number.NaN;
    let courierHeldPaymentsCents = 0;
    for (const payment of order.payments ?? []) {
      if (payment.status === "LOST") continue;
      const cents = toCents(payment.amount);
      if (COURIER_HELD_METHODS.has(String(payment.paymentMethod ?? "").toUpperCase())) {
        // Informativo: no entra en el cálculo, así que un importe roto no bloquea la fila.
        if (Number.isFinite(cents)) courierHeldPaymentsCents += cents;
      } else if (payment.status === "PAID") paidToBusinessCents += cents;
    }
    // Un pedido de total 0 (regalo, 100 % de descuento) no tiene nada que rendir.
    if (totalCents === 0) continue;
    const invalid = !(totalCents > 0) || !Number.isFinite(paidToBusinessCents);
    const expectedCents = invalid ? Number.NaN : Math.max(0, totalCents - paidToBusinessCents);
    const confirmedCents = confirmed.get(order.id) ?? 0;
    const pendingCents = invalid ? Number.NaN : Math.max(0, expectedCents - confirmedCents);
    if (!invalid && pendingCents <= 0) continue;
    const currency = order.currency?.trim() || null;
    const issue: PendingIssue | null = invalid
      ? "INVALID_AMOUNT"
      : (courier.issue ?? (currency && /^[A-Z]{3}$/.test(currency) ? null : "NO_CURRENCY"));
    const updatedAt = order.updated_at ?? order.created_at ?? null;
    rows.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      storeName: order.storeName,
      customerName: order.customer?.fullName?.trim() || "Sin nombre",
      courierLabel: courier.label,
      courierId: courier.courierId,
      currency,
      updatedAt,
      days: daysSince(updatedAt, now),
      totalCents,
      paidToBusinessCents,
      courierHeldPaymentsCents,
      expectedCents,
      confirmedCents,
      pendingCents,
      issue,
    });
  }
  // Lo más viejo primero: es lo primero que hay que reclamar.
  return rows.sort((a, b) => b.days - a.days || a.orderNumber.localeCompare(b.orderNumber));
}

/**
 * Reparte un depósito entre cobros en orden, hasta agotarlo. Con un depósito
 * menor, el resto de los cobros queda confirmado y esperando otro depósito
 * (en «Cobros confirmados»); uno mayor queda como exceso sin asignar.
 */
export function allocateDeposit(amountsCents: readonly number[], depositCents: number): number[] {
  let left = Math.max(0, depositCents);
  return amountsCents.map((amount) => {
    const value = Math.max(0, Math.min(amount, left));
    left -= value;
    return value;
  });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Día local (YYYY-MM-DD) de un timestamp de la API. Cortar el ISO daría el día
 * UTC: en Lima, desde las 19:00 ya es «mañana». "" si no es una fecha válida.
 * `timeZone` solo para tests; sin él se usa la zona del navegador.
 */
export function localDay(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "";
  if (DAY.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Fecha YYYY-MM-DD válida para ms-courier: el día local de la última
 * actualización, nunca posterior a `today` (el día local de hoy).
 */
export function collectionDate(updatedAt: string | null, today: string, timeZone?: string): string {
  const day = localDay(updatedAt, timeZone);
  return day && day <= today ? day : today;
}
