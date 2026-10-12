"use client";

import { useQuery } from "@tanstack/react-query";
import { requestPartnerReferralMetrics } from "../api/partner-referral-metrics.api";
import { useProgramPreferencesSession } from "./use-program-preferences-session";

export const partnerReferralMetricsQueryKey = (userId: string | undefined, epoch: number) =>
  ["partners", "own-referral-metrics", userId ?? "anonymous", epoch] as const;

export function usePartnerReferralMetrics() {
  const session = useProgramPreferencesSession(partnerReferralMetricsQueryKey);
  const query = useQuery({
    queryKey: session.queryKey,
    queryFn: ({ signal }) =>
      session.read(signal, (accessToken) => requestPartnerReferralMetrics({ accessToken, signal })),
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
