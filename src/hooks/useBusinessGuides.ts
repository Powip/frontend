"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const EMPTY_GUIDES: never[] = [];

export function useBusinessGuides<T extends { id: string }>() {
  const { auth } = useAuth();
  const { storeIds, canFetch } = useBusinessScope();
  const query = useQuery({
    queryKey: ["business-guides", auth?.company?.id, auth?.user?.id, storeIds],
    enabled: canFetch,
    queryFn: async ({ signal }) => {
      const responses = await Promise.all(storeIds.map((storeId) => axiosAuth.get<T[]>(
        `${process.env.NEXT_PUBLIC_API_COURIER || GATEWAY.courier}/shipping-guides/store/${storeId}`,
        { signal, headers: { Authorization: `Bearer ${auth!.accessToken}` } },
      )));
      if (responses.some((response) => !Array.isArray(response.data))) throw new Error("Respuesta de guías inválida");
      return Array.from(new Map(responses.flatMap((response) => response.data).map((guide) => [guide.id, guide])).values());
    },
    retry: false,
    staleTime: 60_000,
  });
  const refetch = query.refetch;
  const retry = useCallback(() => refetch(), [refetch]);
  return { guides: canFetch ? query.data ?? EMPTY_GUIDES : EMPTY_GUIDES, loading: canFetch && query.isPending, error: canFetch && query.isError, retry, refetch };
}
