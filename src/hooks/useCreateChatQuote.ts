"use client";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createdFromError,
  quotePayload,
  type CreatedQuote,
  type QuoteDraft,
} from "@/components/ventas-chat/chatQuote";
import { quoteMessage } from "@/components/ventas-chat/quotes";
import { errorMessage } from "@/components/quotations/quotationHelpers";
import { crmKeys } from "@/lib/crmSse";
import { createChatQuote, linkConversationQuote } from "@/services/crmService";

async function createQuote(conversationId: string, draft: QuoteDraft): Promise<CreatedQuote> {
  const linked = await createChatQuote(conversationId, quotePayload(draft));
  return {
    quotationId: linked.quotationId,
    quotationNumber: linked.quotationNumber ?? "",
    publicUrl: linked.publicUrl ?? "",
  };
}

/**
 * Crea el POWIP Link en Core, lo vincula al chat y deja el enlace en la caja
 * (sin enviarlo). Si la cotización se creó pero falló el vínculo, el reintento
 * solo repite el vínculo.
 */
export function useCreateChatQuote(conversationId: string, onInsertMessage?: (text: string) => void) {
  const qc = useQueryClient();
  const created = useRef<CreatedQuote | null>(null);

  async function linkAgain(quote: CreatedQuote): Promise<CreatedQuote> {
    await linkConversationQuote(conversationId, quote);
    return quote;
  }

  function announce(quote: CreatedQuote) {
    created.current = null;
    void qc.invalidateQueries({ queryKey: crmKeys.quotes(conversationId) });
    void qc.invalidateQueries({ queryKey: crmKeys.messages(conversationId) });
    void qc.invalidateQueries({ queryKey: crmKeys.summary });
    if (quote.publicUrl) onInsertMessage?.(quoteMessage(quote.publicUrl));
    toast.success(`POWIP Link ${quote.quotationNumber} listo. Revisa el mensaje y envíalo.`);
  }

  function failure(e: unknown): string {
    created.current = created.current ?? createdFromError(e);
    return created.current
      ? `La cotización ${created.current.quotationNumber} se creó, pero no se pudo vincular al chat: ${errorMessage(e, "intenta de nuevo")}. Pulsa de nuevo para reintentar.`
      : errorMessage(e, "No se pudo crear el pedido.");
  }

  async function finish(quote: Promise<CreatedQuote>): Promise<string | null> {
    try {
      announce(await quote);
      return null;
    } catch (e) {
      return failure(e);
    }
  }

  return {
    /** ¿Hay una cotización creada a la que solo le falta el vínculo? */
    isLinkPending: () => created.current !== null,
    /** Repite solo el vínculo. Devuelve el mensaje de error, o null si quedó listo. */
    async retryLink(): Promise<string | null> {
      return created.current ? finish(linkAgain(created.current)) : null;
    },
    /** Crea la cotización, o repite el vínculo pendiente. Mismo resultado que `retryLink`. */
    submit: (draft: QuoteDraft): Promise<string | null> =>
      finish(created.current ? linkAgain(created.current) : createQuote(conversationId, draft)),
  };
}
