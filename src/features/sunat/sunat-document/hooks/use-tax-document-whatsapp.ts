import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getTaxDocumentWhatsAppAvailabilityApi,
  type SendTaxDocumentWhatsAppRequest,
  type SendTaxDocumentWhatsAppResponse,
  sendTaxDocumentWhatsAppApi,
  type TaxDocumentWhatsAppAvailability,
} from "../api/tax-document-whatsapp.api";

export const TAX_DOCUMENT_WHATSAPP_AVAILABILITY_KEY = [
  "tax-document-whatsapp-availability",
] as const;

export function useTaxDocumentWhatsAppAvailability(enabled: boolean) {
  return useQuery<TaxDocumentWhatsAppAvailability>({
    queryKey: TAX_DOCUMENT_WHATSAPP_AVAILABILITY_KEY,
    queryFn: getTaxDocumentWhatsAppAvailabilityApi,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSendTaxDocumentWhatsApp() {
  return useMutation<SendTaxDocumentWhatsAppResponse, Error, SendTaxDocumentWhatsAppRequest>({
    mutationFn: sendTaxDocumentWhatsAppApi,
  });
}
