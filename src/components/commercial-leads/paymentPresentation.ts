import type { LeadPayment } from "@/types/leadPayments";

export function validPaymentCurrency(currency: string): boolean {
  if (!/^[A-Z]{3}$/.test(currency)) return false;
  return (
    typeof Intl.supportedValuesOf !== "function" ||
    new Set(Intl.supportedValuesOf("currency")).has(currency)
  );
}

export function paymentMoney(
  amount: string | number,
  currency?: string | null,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Importe no disponible";
  return `${currency || "Moneda no informada"} ${value.toFixed(2)}`;
}

export function safePaymentProof(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function paymentGroups(payments: LeadPayment[]) {
  const groups = new Map<
    string,
    { currency: string | null; paid: number; pending: number; lost: number }
  >();
  for (const payment of payments) {
    const key = payment.currency || "UNKNOWN";
    const value = Number(payment.amount);
    if (!Number.isFinite(value)) continue;
    const group = groups.get(key) || {
      currency: payment.currency,
      paid: 0,
      pending: 0,
      lost: 0,
    };
    group[
      payment.status === "PAID"
        ? "paid"
        : payment.status === "PENDING"
          ? "pending"
          : "lost"
    ] += value;
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export function validatePaymentProof(file: File): string | null {
  return !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
    file.type,
  )
    ? "Adjunta un archivo JPG, PNG, WEBP o PDF."
    : file.size > 5 * 1024 * 1024
      ? "El comprobante no puede superar 5 MB."
      : null;
}
