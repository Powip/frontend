"use client";
import { useQuery } from "@tanstack/react-query";
import { getPayoutSettings } from "../services/get-payout-settings";
import { usePayoutSettingsSession } from "./use-payout-settings-session";

export function usePayoutSettings() {
  const session = usePayoutSettingsSession();
  const query = useQuery({
    queryKey: session.queryKey,
    queryFn: ({ signal }) => session.read(signal, (token) => getPayoutSettings(token, signal)),
    enabled: session.enabled,
    retry: false,
    gcTime: 0,
  });
  return {
    ...query,
    data: session.denied ? undefined : query.data,
    error: session.denied ?? query.error,
    isError: Boolean(session.denied || query.isError),
    session,
  };
}
