import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { olvaShipmentKeys } from "@/features/olva/olva-shipment/keys/olva-shipment.keys";
import type { OlvaNiubizPayment } from "@/features/olva/olva-shipment/models/olva-shipment";
import { buildNiubizCheckoutConfig } from "../utils/build-niubiz-checkout-config";
import { loadNiubizCheckoutScript } from "../utils/load-niubiz-checkout-script";

interface UseNiubizCheckoutInput {
  payment: OlvaNiubizPayment;
  registrationNumber: string | null | undefined;
}

/**
 * Opens Niubiz's card form for a shipment that waits for payment. The payment itself is confirmed
 * by Olva: after the form closes the shipment queries are refreshed, and the row's polling shows
 * "Pagado" once Olva reports it. Credentials are never logged.
 */
export function useNiubizCheckout({ payment, registrationNumber }: UseNiubizCheckoutInput) {
  const queryClient = useQueryClient();
  const [isOpening, setIsOpening] = useState(false);

  const open = async () => {
    if (!payment.checkoutScriptUrl) return;

    setIsOpening(true);

    try {
      await loadNiubizCheckoutScript(payment.checkoutScriptUrl);

      const config = buildNiubizCheckoutConfig({
        payment,
        registrationNumber,
        onComplete: () => {
          toast.info("Verificando el pago con Olva…");
          void queryClient.invalidateQueries({ queryKey: olvaShipmentKeys.all });
        },
      });

      if (!config || !window.VisanetCheckout) {
        toast.error("El pago con tarjeta ya no está disponible. Genera un nuevo pago.");
        return;
      }

      window.VisanetCheckout.configure(config);
      window.VisanetCheckout.open();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el pago con tarjeta.");
    } finally {
      setIsOpening(false);
    }
  };

  return { open, isOpening };
}
