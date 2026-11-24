"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  cartLineFromAi,
  paymentFromPolicy,
  quoteDraftError,
  type CartLine,
  type QuoteDraft,
} from "@/components/ventas-chat/chatQuote";
import { phoneForCustomer } from "@/components/ventas-chat/format";
import type { Client } from "@/interfaces/ICliente";
import { buildAiCart } from "@/services/crmOrderPanelService";
import { crmError, getCrmSalesInventories } from "@/services/crmService";
import type { Conversation } from "@/types/crm";
import type { AiCartResult, StorePolicy } from "@/types/crmOrderPanel";
import { useStorePolicy } from "./useCrmOrderPanel";
import { useChatStore } from "./useChatStore";
import { useCreateChatQuote } from "./useCreateChatQuote";

/** Lo que la vendedora termina a mano; sin `cart`, todavía no se leyó el chat. */
export interface QuoteHandoff {
  cart?: CartLine[];
}

interface Options {
  conversation: Conversation;
  client: Client | null | undefined;
  onInsertMessage?: (text: string) => void;
  /** Falta un dato: se abre «Armar pedido» con lo que ya se leyó. */
  onHandoff: (handoff: QuoteHandoff) => void;
}

async function onlyInventoryId(storeId: string): Promise<string | null> {
  const active = (await getCrmSalesInventories(storeId)).filter((i) => i.isActive);
  return active.length === 1 ? active[0].id : null;
}

/** De dónde salió el carrito, para que la vendedora sepa cuánto revisarlo. */
function readingSource({ source, warning }: AiCartResult): string {
  return [`Chat leído con ${source === "ai" ? "IA" : "reglas"}.`, warning].filter(Boolean).join(" ");
}

/**
 * Cierre automático «solo cotizar»: lee el chat, arma la cotización y deja el
 * POWIP Link en la caja. No envía, no aprueba pagos ni convierte en venta.
 */
export function useAiQuote({ conversation, client, onInsertMessage, onHandoff }: Options) {
  const { storeId } = useChatStore(conversation);
  const policyQuery = useStorePolicy(storeId, !!storeId);
  const quote = useCreateChatQuote(conversation.id, onInsertMessage);
  const [running, setRunning] = useState(false);
  const phone = phoneForCustomer(conversation);

  function handoff(reason: string, cart?: CartLine[]) {
    toast.info(reason);
    onHandoff({ cart });
  }

  function report(error: string | null) {
    if (error) toast.error(error);
  }

  async function quoteWith(policy: StorePolicy, inventoryId: string) {
    const reading = await buildAiCart(conversation.id, { storeId, inventoryId });
    const draft: QuoteDraft = {
      name: client?.fullName || conversation.contactName || "",
      phone,
      storeId,
      inventoryId,
      cart: reading.lines.map(cartLineFromAi),
      ...paymentFromPolicy(policy),
      client,
    };
    const missing = quoteDraftError(draft);
    if (missing) return handoff(`${readingSource(reading)} ${missing}`, draft.cart);
    toast.info(readingSource(reading));
    report(await quote.submit(draft));
  }

  async function quoteFromChat() {
    if (quote.isLinkPending()) return report(await quote.retryLink());
    if (!phone) return handoff("Guarda el teléfono del cliente antes de armar el pedido.");
    if (!policyQuery.data) return handoff("No se pudo leer la política de pago de la tienda. Elige el tipo de pago.");
    const inventoryId = await onlyInventoryId(storeId);
    if (!inventoryId) return handoff("Selecciona un almacén para el pedido.");
    return quoteWith(policyQuery.data, inventoryId);
  }

  return {
    loading: running || policyQuery.isLoading,
    async run() {
      setRunning(true);
      try {
        await quoteFromChat();
      } catch (e) {
        // Sin carrito leído: se sigue a mano, sin volver a llamar a la IA.
        handoff(crmError(e).message, []);
      } finally {
        setRunning(false);
      }
    },
  };
}
