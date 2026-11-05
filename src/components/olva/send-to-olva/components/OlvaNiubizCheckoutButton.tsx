"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OlvaNiubizPayment } from "@/features/olva/olva-shipment/models/olva-shipment";
import { useNiubizCheckout } from "../hooks/use-niubiz-checkout";

interface OlvaNiubizCheckoutButtonProps {
  payment: OlvaNiubizPayment;
  /** Olva's registration number: it is the purchase number of the card payment. */
  registrationNumber: string | null | undefined;
}

/**
 * Card payment with Niubiz: opens the checkout form with the session Olva returned. The payment
 * is confirmed by polling the shipment (see `OlvaResultRow`).
 */
export function OlvaNiubizCheckoutButton({
  payment,
  registrationNumber,
}: OlvaNiubizCheckoutButtonProps) {
  const { open, isOpening } = useNiubizCheckout({ payment, registrationNumber });

  // Without the three credentials there is nothing to open (already paid, or the session expired)
  if (!payment.sessionKey || !payment.merchantId || !payment.checkoutScriptUrl) return null;

  return (
    <Button type="button" size="sm" variant="outline" disabled={isOpening} onClick={open}>
      {isOpening ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : (
        <CreditCard className="mr-1 size-4" />
      )}
      Pagar con tarjeta
    </Button>
  );
}
