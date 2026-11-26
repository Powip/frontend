import type { OlvaNiubizPayment } from "@/features/olva/olva-shipment/models/olva-shipment";
import type { VisanetCheckoutConfig } from "./niubiz-checkout.types";

const NIUBIZ_PURCHASE_NUMBER_MAX_LENGTH = 12;
const NIUBIZ_DEFAULT_EXPIRATION_MINUTES = 20;
const MS_PER_MINUTE = 60_000;

/**
 * Optional endpoint that receives the Niubiz transaction token. Olva's docs do not say whether
 * one is needed: set it only if Olva confirms it.
 */
const NIUBIZ_ACTION_URL = process.env.NEXT_PUBLIC_OLVA_NIUBIZ_ACTION_URL;

interface BuildNiubizCheckoutConfigInput {
  payment: OlvaNiubizPayment;
  /** Olva's registration number: used as the purchase number (12 digits, as Niubiz expects). */
  registrationNumber: string | null | undefined;
  onComplete: () => void;
  now?: Date;
}

/** Null when something the form needs is missing (already paid, expired session...). */
export function buildNiubizCheckoutConfig({
  payment,
  registrationNumber,
  onComplete,
  now = new Date(),
}: BuildNiubizCheckoutConfigInput): VisanetCheckoutConfig | null {
  const purchasenumber = (registrationNumber ?? "")
    .replace(/\D/g, "")
    .slice(0, NIUBIZ_PURCHASE_NUMBER_MAX_LENGTH);

  if (!payment.sessionKey || !payment.merchantId || !payment.amount || !purchasenumber) {
    return null;
  }

  const remainingMinutes = payment.expiresAt
    ? Math.floor((payment.expiresAt.getTime() - now.getTime()) / MS_PER_MINUTE)
    : NIUBIZ_DEFAULT_EXPIRATION_MINUTES;

  return {
    sessiontoken: payment.sessionKey,
    merchantid: payment.merchantId,
    channel: "web",
    purchasenumber,
    amount: payment.amount,
    expirationminutes: Math.min(Math.max(remainingMinutes, 1), NIUBIZ_DEFAULT_EXPIRATION_MINUTES),
    timeouturl: window.location.href,
    ...(NIUBIZ_ACTION_URL ? { action: NIUBIZ_ACTION_URL, method: "POST" as const } : {}),
    complete: onComplete,
  };
}
