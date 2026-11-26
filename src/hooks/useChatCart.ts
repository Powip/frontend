"use client";
import { isLinkAlive, lowStockOf } from "@/components/ventas-chat/chatCart";
import { useScript } from "./useCrmContent";
import { useConversationQuotes, useCoreQuotation } from "./useCrmQuotes";

/** Lo que el cliente está por comprar: el último POWIP Link del chat y su primera línea. */
export function useChatCart(conversationId: string | null) {
  const rules = useScript().data?.closingRules;
  const link = useConversationQuotes(conversationId).data?.[0];
  const quotation = useCoreQuotation(link?.quotationId ?? null).data;
  const line = quotation?.lines?.[0];
  return {
    link,
    line,
    storeId: quotation?.storeId ?? link?.storeId ?? null,
    total: quotation?.total ?? link?.total ?? null,
    alive: isLinkAlive(link, quotation),
    lowStock: lowStockOf(line, rules?.lastUnits),
  };
}
