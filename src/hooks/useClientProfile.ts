"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchClientHistory } from "@/services/clients.service";
import { getOtherChannels } from "@/services/crmService";

/** Historial de compras del cliente en Core; falla en silencio con un ms-ventas anterior. */
export function useClientHistory(clientId: string) {
  return useQuery({
    queryKey: ["crm", "client-history", clientId] as const,
    queryFn: () => fetchClientHistory(clientId),
    retry: false,
    staleTime: 60_000,
  });
}

export function useOtherChannels(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["crm", "other-channels", conversationId] as const,
    queryFn: () => getOtherChannels(conversationId),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
