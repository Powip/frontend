"use client";

import { useQuery } from "@tanstack/react-query";
import { requestProgramPreferences } from "../api/program-preferences.api";
import { useProgramPreferencesSession } from "./use-program-preferences-session";

export function useProgramPreferences() {
  const session = useProgramPreferencesSession();
  const query = useQuery({
    queryKey: session.queryKey,
    queryFn: ({ signal }) =>
      session.read(signal, (accessToken) => requestProgramPreferences({ accessToken, signal })),
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
