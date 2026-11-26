import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";

/** ms-integrations: does the company have its own WhatsApp Business number (Cloud API)? */
export interface TaxDocumentWhatsAppAvailability {
  connected: boolean;
  businessPhoneNumber: string | null;
}

export interface SendTaxDocumentWhatsAppRequest {
  sunatDocumentId: string;
  to: string;
  customerName?: string;
}

export interface SendTaxDocumentWhatsAppResponse {
  messageId: string;
  /** "document" inside the 24-hour window, "template" outside it. */
  mode: "document" | "template";
  to: string;
  documentNumber: string;
  /** True when a repeated click returned the earlier send. */
  deduplicated: boolean;
}

export async function getTaxDocumentWhatsAppAvailabilityApi(): Promise<TaxDocumentWhatsAppAvailability> {
  const { data } = await axiosAuth.get<TaxDocumentWhatsAppAvailability>(
    `${API.integrations}/whatsapp/messages/tax-document/availability`,
  );
  return data;
}

export async function sendTaxDocumentWhatsAppApi(
  request: SendTaxDocumentWhatsAppRequest,
): Promise<SendTaxDocumentWhatsAppResponse> {
  const { data } = await axiosAuth.post<SendTaxDocumentWhatsAppResponse>(
    `${API.integrations}/whatsapp/messages/tax-document`,
    request,
  );
  return data;
}

/** Error codes returned by ms-integrations for this send. */
export const TAX_DOCUMENT_WHATSAPP_ERRORS = {
  OWN_NUMBER_NOT_CONNECTED: "WHATSAPP.OWN_NUMBER_NOT_CONNECTED",
  TEMPLATE_NOT_APPROVED: "WHATSAPP.TAX_DOCUMENT_TEMPLATE_NOT_APPROVED",
  SEND_IN_PROGRESS: "WHATSAPP.TAX_DOCUMENT_SEND_IN_PROGRESS",
  NOT_FOUND: "WHATSAPP.TAX_DOCUMENT_NOT_FOUND",
  INVALID_RECIPIENT: "WHATSAPP.INVALID_RECIPIENT",
} as const;

export function getTaxDocumentWhatsAppErrorCode(error: unknown): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof code === "string" ? code : null;
}
