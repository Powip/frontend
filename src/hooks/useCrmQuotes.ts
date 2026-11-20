"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { crmKeys } from "@/lib/crmSse";
import { linkConversationOrder, listConversationQuotes } from "@/services/crmService";
import { getQuotation } from "@/services/quotationService";
import type { Quotation } from "@/types/quotations";
import { useConversationOrders } from "./useCrmChat";

/** POWIP Links de la conversación (más reciente primero). */
export function useConversationQuotes(id: string | null) {
  return useQuery({
    queryKey: crmKeys.quotes(id ?? ""),
    queryFn: () => listConversationQuotes(id!),
    enabled: !!id,
    retry: false,
  });
}

/**
 * Cotización real de Core. Se refresca al volver a la pestaña y cada 60 s
 * mientras no esté convertida. Si falla, la UI usa el número y enlace guardados.
 */
export function useCoreQuotation(quotationId: string) {
  return useQuery({
    queryKey: ["crm", "core-quotation", quotationId] as const,
    queryFn: ({ signal }) => getQuotation(quotationId, { signal }),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.status === "CONVERTIDA" ? false : 60_000),
  });
}

const linkedOrders = new Set<string>();

/**
 * Cuando la cotización ya es pedido, lo vincula a la conversación (una sola vez
 * por pedido; el servidor además es idempotente).
 */
export function useAutoLinkConvertedOrder(
  conversationId: string,
  quotation: Quotation | undefined,
) {
  const qc = useQueryClient();
  const orders = useConversationOrders(conversationId);
  const orderId = quotation?.status === "CONVERTIDA" ? quotation.orderId : null;
  const orderNumber = quotation?.orderNumber ?? undefined;
  const loaded = orders.data;
  useEffect(() => {
    if (!orderId || !loaded) return;
    if (loaded.some((o) => o.orderId === orderId)) return;
    const key = `${conversationId}:${orderId}`;
    if (linkedOrders.has(key)) return;
    linkedOrders.add(key);
    linkConversationOrder(conversationId, { orderId, ...(orderNumber ? { orderNumber } : {}) })
      .then(() => qc.invalidateQueries({ queryKey: crmKeys.orders(conversationId) }))
      .catch(() => linkedOrders.delete(key));
  }, [conversationId, orderId, orderNumber, loaded, qc]);
}
