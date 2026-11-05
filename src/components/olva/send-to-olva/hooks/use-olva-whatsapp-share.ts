import { toast } from "sonner";
import { buildOlvaTrackingWhatsAppUrl } from "../utils/build-olva-tracking-whatsapp-url";
import type { PrintableOrder } from "../utils/fetch-order-receipts";

/** Opens WhatsApp with the tracking message for an order's customer. */
export function useOlvaWhatsappShare() {
  return (order: PrintableOrder, trackingNumber?: string | null) => {
    const url = buildOlvaTrackingWhatsAppUrl({
      customerName: order.customer?.fullName,
      customerPhone: order.customer?.phoneNumber,
      orderNumber: order.orderNumber,
      trackingNumber,
    });

    if (!url) {
      toast.error("El cliente no tiene un teléfono celular válido para WhatsApp");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };
}
