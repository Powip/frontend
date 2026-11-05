import { buildWhatsAppUrl } from "@/utils/whatsapp/build-whatsapp-url";
import { SEND_TO_OLVA_TRACKING_PATH } from "../constants/send-to-olva.constants";

interface BuildOlvaTrackingWhatsAppUrlParams {
  customerName?: string | null;
  customerPhone?: string | null;
  orderNumber: string;
  trackingNumber?: string | null;
  landingUrl?: string;
}

/** The WhatsApp link that tells the customer their order went out with Olva; null without a valid mobile. */
export function buildOlvaTrackingWhatsAppUrl({
  customerName,
  customerPhone,
  orderNumber,
  trackingNumber,
  landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? "",
}: BuildOlvaTrackingWhatsAppUrlParams): string | null {
  const trackingUrl = `${landingUrl}${SEND_TO_OLVA_TRACKING_PATH}/${orderNumber}`;
  const tracking = trackingNumber ? ` Tu número de seguimiento de Olva es ${trackingNumber}.` : "";

  return buildWhatsAppUrl(
    customerPhone,
    `Hola ${customerName || ""}, tu pedido ${orderNumber} ya fue registrado con Olva Courier.${tracking} Puedes seguir tu envío aquí: ${trackingUrl}`,
  );
}
