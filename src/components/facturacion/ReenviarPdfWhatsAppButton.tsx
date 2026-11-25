"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  descargarPdfYAbrirChat,
  enviarPdfPorWhatsApp,
} from "@/app/facturacion/lib/enviar-pdf-whatsapp";
import { Button } from "@/components/ui/button";
import { useActiveTaxDocumentForOrder } from "@/features/sunat/sunat-document/hooks/use-active-tax-document-for-order";
import { useSunatDocumentPdf } from "@/features/sunat/sunat-document/hooks/use-sunat-document-pdf";
import {
  useSendTaxDocumentWhatsApp,
  useTaxDocumentWhatsAppAvailability,
} from "@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp";
import { toWhatsAppDigits } from "@/lib/phone";

const SENDABLE_STATUSES: readonly string[] = ["ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];

interface ReenviarPdfWhatsAppButtonProps {
  orderId: string;
  phone: string | null | undefined;
  customerName?: string | null;
  /** "icon" for table rows, "sm" for the chat order card. */
  size?: "icon" | "sm";
}

/**
 * Resends the accepted tax document PDF of an order by WhatsApp.
 * With the company's own number Powip sends it; without it the PDF is downloaded
 * and the customer's chat opens so the seller attaches it. Hidden without an
 * accepted document.
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
  const { mutateAsync: downloadPdf } = useSunatDocumentPdf();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const availabilityKnown = availability.isSuccess || availability.isError;
  if (!availabilityKnown || !document || !SENDABLE_STATUSES.includes(document.cdrStatus)) {
    return null;
  }

  const connected = availability.data?.connected === true;
  const number = `${document.series}-${document.correlative}`;
  const label = connected
    ? `Reenviar PDF ${number} por WhatsApp`
    : `Descargar PDF ${number} y abrir el chat del cliente`;

  const openChat = () => {
    const to = toWhatsAppDigits(phone);
    const text = encodeURIComponent(
      `Hola ${customerName?.trim() ?? ""}, adjuntamos su comprobante ${number}.`,
    );
    window.open(`https://wa.me/${to}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const downloadAndOpenChat = () =>
    descargarPdfYAbrirChat({ download: downloadPdf, sunatDocumentId: document.id, openChat });

  const handleClick = async () => {
    if (busyRef.current) return;
    if (!toWhatsAppDigits(phone)) {
      toast.error("Esta venta no tiene un teléfono de contacto registrado");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      if (connected) {
        await enviarPdfPorWhatsApp({
          send: sendPdf.mutateAsync,
          sunatDocumentId: document.id,
          phone,
          customerName,
          onFallbackToText: () => {
            void availability.refetch();
            void downloadAndOpenChat();
          },
        });
      } else {
        await downloadAndOpenChat();
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const icon = busy ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <FileText className="h-4 w-4" />
  );

  if (size === "sm") {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={handleClick} title={label}>
        {icon} Reenviar PDF
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="outline"
      className="border-green-600 text-green-700 hover:bg-green-50"
      disabled={busy}
      onClick={handleClick}
      title={label}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
