import { OrderHeader } from "@/interfaces/IOrder";
import {
  COURIER_COMMISSION_PCT,
  COURIER_DIAS_LIMITE,
  DEFAULT_COMMISSION_PCT,
  DEFAULT_DIAS_LIMITE,
  DEFAULT_FLETE,
  FLETE_BY_REGION,
  GuiaPorLiquidar,
} from "./types";

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}S/ ${Math.abs(n).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function paidAmount(order: OrderHeader): number {
  return (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Heurística best-effort para detectar una entrega parcial ya anotada desde
 * Pedidos, igual de "mejor esfuerzo" que `guessFailureReason` del Tablero
 * (src/app/operaciones/page.tsx). BACKEND GAP: no hay campo estructurado —
 * ver comentario en types.ts sobre `entregaParcial`.
 */
function detectEntregaParcial(
  order: OrderHeader,
): { motivo: string; diferenciaEstimada: number } | null {
  const notes = (order.notes ?? "").toLowerCase();
  if (!notes.includes("parcial") && !notes.includes("diferencia")) return null;
  return {
    motivo: order.notes ?? "Entrega parcial reportada desde Pedidos",
    // BACKEND GAP: no hay monto estructurado de la diferencia, no se puede
    // estimar de forma confiable desde texto libre — se deja en 0 y se
    // señala en la UI que el monto es referencial.
    diferenciaEstimada: 0,
  };
}

/**
 * Construye las filas de "Por Liquidar" a partir de pedidos reales
 * ENTREGADO con courier asignado y saldo pendiente (dinero que el courier
 * cobró en la entrega y todavía no depositó). El resto de los campos
 * (comisión, plazo, estado) se calculan localmente — ver BACKEND GAP en
 * types.ts.
 *
 * @param coveredOrderNumbers orderNumbers ya cubiertos por una liquidación
 *   registrada en esta sesión (estado local, no persiste — ver page.tsx).
 */
export function buildGuiasPorLiquidar(
  orders: OrderHeader[],
  coveredOrderNumbers: Set<string>,
): GuiaPorLiquidar[] {
  return orders
    .filter((o) => o.status === "ENTREGADO" && !!o.courier)
    .map((o) => {
      const codBruto = Number(o.grandTotal || 0);
      const adelantos = paidAmount(o);
      const codNeto = Math.max(0, codBruto - adelantos);
      const courier = (o.courier ?? "").trim();
      const comisionPct = COURIER_COMMISSION_PCT[courier] ?? DEFAULT_COMMISSION_PCT;
      const diasLimite = COURIER_DIAS_LIMITE[courier] ?? DEFAULT_DIAS_LIMITE;
      const comision = codNeto * comisionPct;
      const flete = FLETE_BY_REGION[o.salesRegion] ?? DEFAULT_FLETE;
      const neto = Math.max(0, codNeto - comision - flete);
      const saldoPendiente = coveredOrderNumbers.has(o.orderNumber) ? 0 : neto;
      const diasTranscurridos = daysSince(o.updated_at ?? o.created_at);
      const vencido = diasTranscurridos > diasLimite && saldoPendiente > 0;

      return {
        id: o.orderNumber,
        orderId: o.id,
        cliente: o.customer?.fullName ?? "Sin nombre",
        ciudad: o.customer?.city || o.salesRegion,
        courier,
        entregadoAt: o.updated_at ?? null,
        diasTranscurridos,
        diasLimite,
        codBruto,
        adelantos,
        codNeto,
        comisionPct,
        comision,
        flete,
        neto,
        saldoPendiente,
        estado: saldoPendiente <= 0 ? "LIQUIDADO" : vencido ? "VENCIDO" : "PENDIENTE",
        vencido,
        entregaParcial: detectEntregaParcial(o),
      } satisfies GuiaPorLiquidar;
    })
    .filter((g) => g.saldoPendiente > 0 || g.estado === "LIQUIDADO");
}

/** Normalización de teléfono peruano para WhatsApp — misma regla que Pedidos (types.ts). */
function normalizePeruPhone(phoneNumber: string): string {
  let cleanPhone = phoneNumber.replace(/\D/g, "");
  if (!cleanPhone.startsWith("51")) {
    if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
    cleanPhone = `51${cleanPhone}`;
  }
  return cleanPhone;
}

/** Mensaje de recordatorio de saldo pendiente, personalizado por cliente. */
export function buildSaldoWhatsAppMessage(
  cliente: string,
  orderNumber: string,
  saldo: number,
): string {
  return `Hola ${cliente} 👋 Tu pedido ${orderNumber} quedó con un saldo de ${money(
    saldo,
  )}. Puedes pagarlo por Yape o al recibir. ¡Gracias por tu compra! 🙌`;
}

export function openSaldoWhatsApp(
  telefono: string,
  cliente: string,
  orderNumber: string,
  saldo: number,
) {
  const cleanPhone = normalizePeruPhone(telefono);
  const message = buildSaldoWhatsAppMessage(cliente, orderNumber, saldo);
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
