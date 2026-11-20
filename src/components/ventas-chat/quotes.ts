import type { Quotation, QuotationPaymentMethod, QuotationPaymentStatus } from "@/types/quotations";
import { quotationStatus } from "@/components/quotations/quotationHelpers";

export const QUOTE_STATUS_LABEL = {
  PREVENTA: "Pendiente",
  VENCIDA: "Vencida",
  CONVERTIDA: "Convertida en pedido",
} as const;

export const QUOTE_PAYMENT_METHOD_LABEL: Record<QuotationPaymentMethod, string> = {
  YAPE_QR: "Yape",
  MERCADO_PAGO: "Mercado Pago",
  TRANSFERENCIA: "Transferencia",
};

export const QUOTE_PAYMENT_STATUS_LABEL: Record<QuotationPaymentStatus, string> = {
  PENDIENTE: "por revisar",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
};

/** Estado legible de la cotización (la vigencia vencida cuenta como «Vencida»). */
export function quoteStatusLabel(q: Pick<Quotation, "status" | "expiresAt">) {
  return QUOTE_STATUS_LABEL[quotationStatus(q)];
}

/** Texto que se deja en la caja del chat (la vendedora lo revisa y lo envía). */
export function quoteMessage(publicUrl: string) {
  return `Te dejo tu pedido para confirmar y pagar: ${publicUrl}`;
}

/** Cotizaciones abre una cotización concreta con `?quotationId=`. */
export function abrirCotizacionUrl(quotationId: string) {
  return `/cotizaciones?quotationId=${encodeURIComponent(quotationId)}`;
}

/** Añade `text` a lo que ya hay en la caja, en línea nueva. */
export function appendLine(current: string, text: string) {
  return current.trim() ? `${current.replace(/\s+$/, "")}\n${text}` : text;
}
