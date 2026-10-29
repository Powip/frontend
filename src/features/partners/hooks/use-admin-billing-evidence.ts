"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  requestAdminBillingEvidence,
  requestAdminBillingEvidenceDetail,
} from "../api/admin-billing-evidence.api";
import { partnersKeys } from "../keys/partners.keys";
import type { BillingEvidenceState } from "../schemas/admin-billing-evidence.schema";
import { useAdminReadSession } from "./use-admin-read-session";

export function useAdminBillingEvidence(state: BillingEvidenceState | null = null, limit = 20) {
  const session = useAdminReadSession();
  const query = useInfiniteQuery({
    queryKey: [
      ...partnersKeys.adminRead(session.userId),
      "billing-evidence",
      session.epoch,
      state,
      limit,
    ],
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        requestAdminBillingEvidence({ accessToken, cursor: pageParam, limit, state, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
  return {
    ...query,
    data: session.enabled ? query.data : undefined,
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    isSuccess: session.enabled && query.isSuccess,
  };
}
export function useAdminBillingEvidenceDetail(evidenceId: string | null) {
  const session = useAdminReadSession(evidenceId !== null);
  const query = useQuery({
    queryKey: [
      ...partnersKeys.adminRead(session.userId),
      "billing-evidence-detail",
      session.epoch,
      evidenceId,
    ],
    queryFn: ({ signal }) =>
      session.read(signal, (accessToken) =>
        requestAdminBillingEvidenceDetail({
          accessToken,
          evidenceId: evidenceId as string,
          signal,
        }),
      ),
    enabled: session.enabled,
    retry: false,
  });
  return {
    ...query,
    data: session.enabled ? query.data : undefined,
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    isSuccess: session.enabled && query.isSuccess,
  };
}
