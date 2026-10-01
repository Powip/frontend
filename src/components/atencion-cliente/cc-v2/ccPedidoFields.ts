import type { OrderHeader, SubEstadoCc } from "@/interfaces/IOrder";
import { DISPATCH_STATUS_MAP } from "@/components/aliclik/AliclikStatusBadge";
import { STATUS_LABEL as EVA_STATUS_LABEL } from "@/components/eva/EvaStatusBadge";
import { isEvaCourier } from "@/utils/courierNormalizer";

/**
 * Valores derivados de un pedido CC que comparten la tabla (CcPedidosTable),
 * el buscador y la exportación a Excel — una sola fuente de verdad para que
 * lo exportado coincida con lo que se ve en pantalla.
 */

export const SUB_ESTADO_LABEL: Record<SubEstadoCc, string> = {
  por_confirmar: "Por confirmar",
  contactado: "Contactado",
  no_contesta: "No contesta",
  anulado_cc: "Anulado CC",
  confirmado: "Confirmado",
  reprogramado: "Reprogramado",
  entrega_lima: "Entrega Lima",
  carrito_sin_contactar: "Sin contactar",
  carrito_contactado: "Contactado",
  carrito_recuperado: "Recuperado ✓",
};

export const MAX_INTENTOS_CC = 3;

export function resolveStoreName(order: OrderHeader): string | null {
  const src = order.externalSource?.toLowerCase() ?? "";

  if (src === "shopify" || src.includes("shopify")) {
    const raw = order.externalData;
    if (!raw) return null;

    const parsed: any =
      typeof raw === "string"
        ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
        : raw;
    if (!parsed) return null;

    const vendor = parsed?.line_items?.[0]?.vendor;
    if (vendor && String(vendor).trim()) return String(vendor).trim().toUpperCase();

    const statusUrl = parsed?.order_status_url;
    if (statusUrl) {
      try {
        const host = new URL(String(statusUrl)).hostname.replace(/^www\./, "").split(".")[0];
        if (host) return host.toUpperCase();
      } catch { /* URL malformada */ }
    }
    return null;
  }

  if (src === "google_sheets") return "SHEETS";
  if (src) return src.toUpperCase();
  return null;
}

export function getPedidoMontos(order: OrderHeader) {
  const grandTotal = Number(order.grandTotal ?? 0);
  const totalPaid = (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const porCobrar = Math.max(grandTotal - totalPaid, 0);
  return { grandTotal, totalPaid, porCobrar };
}

export function getUpsellCount(order: OrderHeader): number {
  return (order.items ?? [])
    .filter((i) => i.isPromoItem)
    .reduce((s, i) => s + (i.quantity ?? 0), 0);
}

export function isDniFaltante(order: OrderHeader): boolean {
  return !order.datosCompletos && !order.dniCliente;
}

export function getAliclikLabel(order: OrderHeader): string {
  const status = order.aliclikDispatchStatus;
  if (!status && !order.aliclikSyncedAt) return "";
  if (!status) return "En Aliclik";
  return DISPATCH_STATUS_MAP[status]?.label ?? status;
}

/** Sin estado EVA pero con courier EVA → la tabla muestra el botón "Enviar". */
export function getEvaLabel(order: OrderHeader): string {
  if (order.evaStatus) return EVA_STATUS_LABEL[order.evaStatus] ?? order.evaStatus;
  if (isEvaCourier(order.courier)) return "Sin enviar";
  return "";
}

/** Resumen legible de productos: "2x Polo (Talla: M) · 1x Gorra". */
export function getResumenProductos(order: OrderHeader): string {
  return (order.items ?? [])
    .map((i) => {
      const attrs = Object.entries(i.attributes ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const promo = i.isPromoItem ? " [upsell]" : "";
      return `${i.quantity}x ${i.productName}${attrs ? ` (${attrs})` : ""}${promo}`;
    })
    .join(" · ");
}

/**
 * Mismos criterios que el buscador de Comercial → Ventas (SalesTableFilters):
 * nombre del cliente y N° de orden sin distinguir mayúsculas, teléfono por
 * coincidencia parcial. Además ignora espacios/guiones/prefijo en el teléfono
 * para que "999 111 222" encuentre "999111222".
 */
export function matchesCcSearch(order: OrderHeader, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;

  const name = (order.customer?.fullName ?? "").toLowerCase();
  const orderNumber = (order.orderNumber ?? "").toLowerCase();
  const phone = order.customer?.phoneNumber ?? "";

  if (name.includes(q) || orderNumber.includes(q) || phone.includes(term.trim())) return true;

  const qDigits = q.replace(/\D/g, "");
  return qDigits.length >= 3 && phone.replace(/\D/g, "").includes(qDigits);
}
