import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WHATSAPP_NOTIFICATIONS_QUERY_KEY } from "@/components/whatsapp/WhatsAppNotificationsBell";
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
  const queryClient = useQueryClient();
  return useMutation<SendTaxDocumentWhatsAppResponse, Error, SendTaxDocumentWhatsAppRequest>({
    mutationFn: sendTaxDocumentWhatsAppApi,
    // Every send, ok or failed, leaves a notice in the sidebar bell: show it now, not in 60 s.
    onSettled: () => queryClient.invalidateQueries({ queryKey: WHATSAPP_NOTIFICATIONS_QUERY_KEY }),
  });
}
