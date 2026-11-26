"use client";
import { useState } from "react";
import { CreditCard, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallSessionMutations } from "@/hooks/useCallSessions";
import { useGeneralMaterials, useScript } from "@/hooks/useCrmContent";
import { useConversationQuotes } from "@/hooks/useCrmQuotes";
import type { Material } from "@/types/crmContent";
import { dispatchText } from "./ChatSaleGuide";
import { materialText } from "./ContentLib";
import { CALL_BUTTON_CLASS } from "./WhatsAppCallButton";
import { quoteMessage } from "./quotes";

interface SendProps {
  sending: boolean;
  send: (body: string, onSent: () => void) => void;
}

function chargeHint(hasLink: boolean, sent: boolean): string {
  if (sent) return "Link enviado · esperando el pago…";
  return hasLink
    ? "Le llega a su WhatsApp mientras hablan. Paga con Yape sin colgar."
    : "Arma el pedido en el chat para poder enviar el POWIP Link.";
}

/** Cobra sin colgar: manda el último POWIP Link armado en el chat. */
function ChargeInCall({ conversationId, sending, send }: SendProps & { conversationId: string }) {
  const url = useConversationQuotes(conversationId).data?.[0]?.publicUrl;
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-1.5 rounded-lg border p-2">
      <p className="text-xs font-semibold">Cobrar sin colgar</p>
      <Button
        type="button"
        size="sm"
        className={`w-full ${CALL_BUTTON_CLASS}`}
        disabled={!url || sending}
        onClick={() => url && send(quoteMessage(url), () => setSent(true))}
      >
        <CreditCard /> Enviar link ahora
      </Button>
      <p className="text-[11px] text-muted-foreground" role="status">
        {chargeHint(!!url, sent)}
      </p>
    </div>
  );
}

function MaterialInCall({ materials, sending, send }: SendProps & { materials: Material[] }) {
  const [sent, setSent] = useState<string[]>([]);
  if (materials.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-lg border p-2">
      <p className="text-xs font-semibold">Enviar material al chat</p>
      <div className="flex flex-wrap gap-1">
        {materials.map((m) => (
          <Button
            key={m.id}
            type="button"
            size="sm"
            variant="outline"
            disabled={sending || sent.includes(m.id)}
            onClick={() => send(materialText(m), () => setSent((ids) => [...ids, m.id]))}
          >
            <ImageIcon /> {m.title}
            {sent.includes(m.id) && " · enviado"}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Lo que la vendedora puede hacer en el chat sin colgar. */
export default function CallLiveTools({ conversationId }: { conversationId: string }) {
  const { sendToChat } = useCallSessionMutations();
  const materials = useGeneralMaterials(true).data ?? [];
  const dispatch = dispatchText(useScript(true).data?.closingRules);
  const tools: SendProps = {
    sending: sendToChat.isPending,
    send: (body, onSent) => sendToChat.mutate({ conversationId, body }, { onSuccess: onSent }),
  };
  return (
    <div className="space-y-2">
      <ChargeInCall conversationId={conversationId} {...tools} />
      <MaterialInCall materials={materials} {...tools} />
      {dispatch && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{dispatch}</p>}
    </div>
  );
}
