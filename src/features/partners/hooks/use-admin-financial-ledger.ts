"use client";

import { CancelledError, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  requestAdminFinancialBalance,
  requestAdminFinancialLedger,
} from "../api/financial-ledger.api";
import { partnersKeys } from "../keys/partners.keys";
import { financialLedgerPartnerIdSchema } from "../schemas/financial-ledger.schema";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminFinancialLedger(partnerId: string | null, limit = 20) {
  const parsed = financialLedgerPartnerIdSchema.safeParse(partnerId);
  const selected = parsed.success ? parsed.data : null;
  const session = useAdminReadSession(selected !== null);
  const query = useInfiniteQuery({
    queryKey: [
      ...partnersKeys.adminRead(session.userId),
      "session",
      session.epoch,
      "financial-ledger",
      selected,
      limit,
    ],
    queryFn: ({ signal, pageParam }) => {
      if (!selected) throw new CancelledError({ silent: true });
      return session.read(signal, (accessToken) =>
        requestAdminFinancialLedger({
          accessToken,
          signal,
          partnerId: selected,
          cursor: pageParam,
          limit,
        }),
      );
    },
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

export function useAdminFinancialBalance(partnerId: string | null) {
  const parsed = financialLedgerPartnerIdSchema.safeParse(partnerId);
  const selected = parsed.success ? parsed.data : null;
  const session = useAdminReadSession(selected !== null);
  const query = useQuery({
    queryKey: [
      ...partnersKeys.adminRead(session.userId),
      "session",
      session.epoch,
      "financial-balance",
      selected,
    ],
    queryFn: ({ signal }) => {
      if (!selected) throw new CancelledError({ silent: true });
      return session.read(signal, (accessToken) =>
        requestAdminFinancialBalance({ accessToken, signal, partnerId: selected }),
      );
    },
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
