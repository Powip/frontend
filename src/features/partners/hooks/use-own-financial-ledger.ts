"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { requestOwnFinancialBalance, requestOwnFinancialLedger } from "../api/financial-ledger.api";
import { useCommissionReadSession } from "./use-commission-read-session";

export function useOwnFinancialLedger(limit = 20) {
  const session = useCommissionReadSession();
  const query = useInfiniteQuery({
    queryKey: [...session.queryKey, "ledger", limit],
    queryFn: ({ signal, pageParam }) =>
      session.read(signal, (accessToken) =>
        requestOwnFinancialLedger({ accessToken, signal, cursor: pageParam, limit }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasMore ? page.nextCursor : undefined),
    enabled: session.enabled,
    retry: false,
    gcTime: 0,
  });
  return {
    ...query,
    data: session.enabled ? query.data : undefined,
    isSuccess: session.enabled && query.isSuccess,
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    session,
  };
}
export function useOwnFinancialBalance() {
  const session = useCommissionReadSession();
  const query = useQuery({
    queryKey: [...session.queryKey, "ledger-balance"],
    queryFn: ({ signal }) =>
      session.read(signal, (accessToken) => requestOwnFinancialBalance({ accessToken, signal })),
    enabled: session.enabled,
    retry: false,
    gcTime: 0,
  });
  return {
    ...query,
    data: session.enabled ? query.data : undefined,
    isSuccess: session.enabled && query.isSuccess,
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    session,
  };
}
