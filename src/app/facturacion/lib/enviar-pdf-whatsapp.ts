import { toast } from "sonner";
import {
  getTaxDocumentWhatsAppErrorCode,
  type SendTaxDocumentWhatsAppRequest,
  type SendTaxDocumentWhatsAppResponse,
  TAX_DOCUMENT_WHATSAPP_ERRORS,
} from "@/features/sunat/sunat-document/api/tax-document-whatsapp.api";
import type { DownloadFileResult } from "@/types/download-file.types";
import { downloadFile } from "@/utils/http/download-file";

export const AVISO_SIN_NUMERO_PROPIO =
  "Tu empresa no tiene un número de WhatsApp Business conectado: se descargó el PDF y se abrió el chat del cliente. Adjunta el PDF en ese chat.";

export const AVISO_PDF_NO_DESCARGADO =
  "Se abrió el chat del cliente, pero no se pudo descargar el PDF. Descárgalo desde Facturación y adjúntalo.";

interface EnviarPdfPorWhatsAppParams {
  send: (request: SendTaxDocumentWhatsAppRequest) => Promise<SendTaxDocumentWhatsAppResponse>;
  sunatDocumentId: string;
  /** Customer phone as typed in the sale; only digits are sent. */
  phone: string | null | undefined;
  customerName?: string | null;
  /** Called once the PDF was sent (or the backend reports it was already sent). */
  onSent?: () => void;
  /** Called when the company's own number is no longer connected: download the PDF and open the chat. */
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
      // The fallback downloads the PDF, opens the chat and says so on screen.
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

interface DescargarPdfYAbrirChatParams {
  download: (sunatDocumentId: string) => Promise<DownloadFileResult>;
  sunatDocumentId: string;
  /** Opens the customer's chat (wa.me with the text). Runs first, inside the click, so the browser does not block it. */
  openChat: () => void;
}

/**
 * Without the company's own number Powip cannot send the PDF: it downloads the
 * PDF and opens the customer's chat so the seller attaches it. The PDF is never
 * published nor linked.
 */
export async function descargarPdfYAbrirChat({
  download,
  sunatDocumentId,
  openChat,
}: DescargarPdfYAbrirChatParams): Promise<void> {
  openChat();

  try {
    downloadFile(await download(sunatDocumentId));
    toast.info(AVISO_SIN_NUMERO_PROPIO);
  } catch (error) {
    console.error("Error downloading tax document PDF for WhatsApp:", error);
    toast.error(AVISO_PDF_NO_DESCARGADO);
  }
}
