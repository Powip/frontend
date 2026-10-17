import type { Quotation, QuotationLine } from "@/types/quotations";

export const money = (value: number | string | null | undefined) =>
  `S/${Number(value || 0).toFixed(2)}`;

export function quotationStatus(quotation: Pick<Quotation, "status" | "expiresAt">) {
  return quotation.status === "PREVENTA" && new Date(quotation.expiresAt).getTime() <= Date.now()
    ? "VENCIDA"
    : quotation.status;
}

export function lineHasStockIssue(line: QuotationLine) {
  if (line.isManual) return false;
  const available = line.stockAvailable;
  return Boolean(line.stockInsufficient || (available != null && available < line.quantity));
}

export const quotationHasStockIssue = (quotation: Pick<Quotation, "lines">) =>
  quotation.lines.some(lineHasStockIssue);

export function formatExpiry(quotation: Pick<Quotation, "status" | "expiresAt">) {
  if (quotation.status === "CONVERTIDA") return "—";
  const minutes = Math.ceil((new Date(quotation.expiresAt).getTime() - Date.now()) / 60000);
  if (minutes <= 0 || quotation.status === "VENCIDA") return "Venció";
  return minutes < 60 ? `Vence en ${minutes} min` : `Vence en ${Math.ceil(minutes / 60)} h`;
}

export function quotationWhatsAppUrl(
  quotation: Pick<Quotation, "customerPhone" | "customerName" | "publicUrl" | "number">,
) {
  let phone = quotation.customerPhone.replace(/\D/g, "");
  if (phone.length === 9) phone = `51${phone}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${quotation.customerName}, aquí puedes revisar y confirmar tu cotización ${quotation.number}: ${quotation.publicUrl}`)}`;
}

export function errorMessage(error: unknown, fallback: string) {
  const apiMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  if (Array.isArray(apiMessage)) return apiMessage.join(". ");
  if (apiMessage) return apiMessage;
  return error instanceof Error ? error.message : fallback;
}

export const statusLabels = { PREVENTA: "Preventa", VENCIDA: "Vencida", CONVERTIDA: "Convertida" };

export const statusClasses = {
  PREVENTA: "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  VENCIDA: "border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  CONVERTIDA:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
};
