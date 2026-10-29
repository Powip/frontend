"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  requestOwnCommissionEvaluations,
  requestOwnCommissionItems,
} from "../api/commission-read.api";
import { useCommissionReadSession } from "./use-commission-read-session";

export function useOwnCommissionItems(limit = 20) {
  const session = useCommissionReadSession();
  const query = useInfiniteQuery({
    queryKey: [...session.queryKey, "items", limit],
    queryFn: ({ signal, pageParam }) =>
      session.read(signal, (accessToken) =>
        requestOwnCommissionItems({ accessToken, signal, cursor: pageParam, limit }),
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
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    session,
  };
}

export function useOwnCommissionEvaluations(limit = 20) {
  const session = useCommissionReadSession();
  const query = useInfiniteQuery({
    queryKey: [...session.queryKey, "evaluations", limit],
    queryFn: ({ signal, pageParam }) =>
      session.read(signal, (accessToken) =>
        requestOwnCommissionEvaluations({ accessToken, signal, cursor: pageParam, limit }),
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
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    session,
  };
}
