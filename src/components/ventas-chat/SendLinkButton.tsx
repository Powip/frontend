"use client";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatCart } from "@/hooks/useChatCart";
import { useConversationOrders } from "@/hooks/useCrmChat";
import type { Conversation } from "@/types/crm";
import { formatMoney } from "./format";
import { quoteMessage } from "./quotes";
import { CALL_BUTTON_CLASS } from "./WhatsAppCallButton";

interface Props {
  conversation: Conversation;
  onInsert: (text: string) => void;
  disabled: boolean;
}

/** «Enviar POWIP Link · total» bajo la caja: deja el link en el mensaje para revisarlo. */
export default function SendLinkButton({ conversation, onInsert, disabled }: Props) {
  const { link, total, alive } = useChatCart(conversation.id);
  const orders = useConversationOrders(conversation.id).data ?? [];
  if (orders.length > 0 || conversation.status === "closed") return null;
  const url = alive ? link?.publicUrl : null;
  const amount = total === null ? "" : ` · ${formatMoney(total)}`;
  return (
    <Button
      variant={url ? "default" : "secondary"}
      className={cn("mt-2 h-auto min-h-9 w-full whitespace-normal", url && CALL_BUTTON_CLASS)}
      disabled={disabled || !url}
      onClick={() => url && onInsert(quoteMessage(url))}
      data-testid="send-link"
    >
      <Link2 aria-hidden />
      {url ? `Enviar POWIP Link${amount}` : "Arma el pedido en el panel para enviar el POWIP Link"}
    </Button>
  );
}
