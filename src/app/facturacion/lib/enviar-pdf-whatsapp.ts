import { toast } from "sonner";
import {
  getTaxDocumentWhatsAppErrorCode,
  type SendTaxDocumentWhatsAppRequest,
  type SendTaxDocumentWhatsAppResponse,
  TAX_DOCUMENT_WHATSAPP_ERRORS,
} from "@/features/sunat/sunat-document/api/tax-document-whatsapp.api";

export const AVISO_SIN_NUMERO_PROPIO =
  "Tu empresa no tiene un número de WhatsApp Business conectado: se abrirá WhatsApp con el texto del comprobante, sin el PDF.";

interface EnviarPdfPorWhatsAppParams {
  send: (request: SendTaxDocumentWhatsAppRequest) => Promise<SendTaxDocumentWhatsAppResponse>;
  sunatDocumentId: string;
  /** Customer phone as typed in the sale; only digits are sent. */
  phone: string | null | undefined;
  customerName?: string | null;
  /** Called once the PDF was sent (or the backend reports it was already sent). */
  onSent?: () => void;
  /** Called when the company's own number is no longer connected: open wa.me with text. */
  onFallbackToText: () => void;
}

/**
 * Sends the tax document PDF through the company's own WhatsApp Business number
 * (ms-integrations) and shows the same messages wherever it is used
 * (Ver / Compartir modal and the WhatsApp icon of each table row).
 */
export async function enviarPdfPorWhatsApp({
  send,
  sunatDocumentId,
  phone,
  customerName,
  onSent,
  onFallbackToText,
}: EnviarPdfPorWhatsAppParams): Promise<void> {
  const digits = phone?.replace(/\D/g, "");

  if (!digits) {
    toast.error("Esta venta no tiene un teléfono de contacto registrado");
    return;
  }

  try {
    const result = await send({
      sunatDocumentId,
      to: digits,
      customerName: customerName ?? undefined,
    });

    toast.success(
      result.deduplicated
        ? "Este comprobante ya se envió por WhatsApp hace un momento"
        : `PDF enviado por WhatsApp a +${result.to}`,
    );

    onSent?.();
  } catch (error) {
    const code = getTaxDocumentWhatsAppErrorCode(error);

    if (code === TAX_DOCUMENT_WHATSAPP_ERRORS.OWN_NUMBER_NOT_CONNECTED) {
      toast.info(
        "Tu número de WhatsApp ya no está conectado: se abrirá WhatsApp con el texto, sin el PDF",
      );
      onFallbackToText();
    } else if (code === TAX_DOCUMENT_WHATSAPP_ERRORS.TEMPLATE_NOT_APPROVED) {
      toast.error(
        "El cliente no escribió en las últimas 24 h y la plantilla «comprobante_pdf» aún no está aprobada por Meta",
      );
    } else if (code === TAX_DOCUMENT_WHATSAPP_ERRORS.SEND_IN_PROGRESS) {
      toast.info("El comprobante ya se está enviando");
    } else if (code === TAX_DOCUMENT_WHATSAPP_ERRORS.INVALID_RECIPIENT) {
      toast.error("El teléfono del cliente no es un número de WhatsApp válido");
    } else {
      console.error("Error sending tax document by WhatsApp:", error);
      toast.error("No se pudo enviar el comprobante por WhatsApp");
    }
  }
}
