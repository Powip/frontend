"use client";

import { FileText, Loader2 } from "lucide-react";
import { enviarPdfPorWhatsApp } from "@/app/facturacion/lib/enviar-pdf-whatsapp";
import { Button } from "@/components/ui/button";
import { useActiveTaxDocumentForOrder } from "@/features/sunat/sunat-document/hooks/use-active-tax-document-for-order";
import {
  useSendTaxDocumentWhatsApp,
  useTaxDocumentWhatsAppAvailability,
} from "@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp";

const SENDABLE_STATUSES: readonly string[] = ["ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];

interface ReenviarPdfWhatsAppButtonProps {
  orderId: string;
  phone: string | null | undefined;
  customerName?: string | null;
  /** "icon" for table rows, "sm" for the chat order card. */
  size?: "icon" | "sm";
}

/**
 * Resends the accepted tax document PDF of an order from the company's own
 * WhatsApp number. Hidden without own number or without an accepted document:
 * then there is nothing to resend from Powip.
 */
export function ReenviarPdfWhatsAppButton({
  orderId,
  phone,
  customerName,
  size = "icon",
}: ReenviarPdfWhatsAppButtonProps) {
  const availability = useTaxDocumentWhatsAppAvailability(true);
  const document = useActiveTaxDocumentForOrder(orderId);
  const sendPdf = useSendTaxDocumentWhatsApp();

  if (
    !availability.data?.connected ||
    !document ||
    !SENDABLE_STATUSES.includes(document.cdrStatus)
  ) {
    return null;
  }

  const label = `Reenviar PDF ${document.series}-${document.correlative} por WhatsApp`;
  const handleClick = () =>
    enviarPdfPorWhatsApp({
      send: sendPdf.mutateAsync,
      sunatDocumentId: document.id,
      phone,
      customerName,
      // The helper already told the user the number is gone; the button hides on the next check.
      onFallbackToText: () => availability.refetch(),
    });

  const icon = sendPdf.isPending ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <FileText className="h-4 w-4" />
  );

  if (size === "sm") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={sendPdf.isPending}
        onClick={handleClick}
        title={label}
      >
        {icon} Reenviar PDF
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="outline"
      className="border-green-600 text-green-700 hover:bg-green-50"
      disabled={sendPdf.isPending}
      onClick={handleClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
