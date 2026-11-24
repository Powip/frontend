"use client";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallPermission } from "@/hooks/useCallSessions";
import { requestWhatsAppCall } from "./WhatsAppCallOverlay";

export const CALL_BUTTON_CLASS = "bg-teal-600 text-white hover:bg-teal-700";
const NOT_WHATSAPP = "Las llamadas funcionan por WhatsApp y con número del cliente";

/** Llama al cliente por WhatsApp desde Powip; sin permiso, primero lo pide. */
export default function WhatsAppCallButton({
  conversationId,
  contactName,
  available = true,
  askLabel = "Pedir llamada",
}: {
  conversationId: string;
  contactName?: string | null;
  /** `false` en los canales donde no se puede llamar. */
  available?: boolean;
  /** Texto cuando el cliente aún no dio permiso. */
  askLabel?: string;
}) {
  const { data } = useCallPermission(available ? conversationId : null);
  const mustAsk = !!data && !data.canCall;
  const title = mustAsk ? "Primero pide permiso para llamar" : "Llamar por WhatsApp";
  return (
    <Button
      type="button"
      size="sm"
      className={CALL_BUTTON_CLASS}
      disabled={!available}
      title={available ? title : NOT_WHATSAPP}
      onClick={() =>
        requestWhatsAppCall({
          kind: "call",
          conversationId,
          contactName,
          ...(data?.canCall ? { start: { simulated: data.simulated } } : {}),
        })
      }
    >
      <PhoneCall /> {mustAsk ? askLabel : "Llamar"}
    </Button>
  );
}
