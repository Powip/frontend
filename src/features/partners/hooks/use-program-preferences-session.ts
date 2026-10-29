"use client";

import { CancelledError, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import {
  adminReadDenialFor,
  adminReadSessionEpoch,
  denyAdminReadSession,
  getAdminReadDenialSnapshot,
  getServerAdminReadDenialSnapshot,
  subscribeAdminReadDenial,
} from "../utils/admin-read-session-state";
import {
  denyProgramPreferencesSession,
  getProgramPreferencesDenial,
  programPreferencesDenialSnapshot,
  serverProgramPreferencesDenialSnapshot,
  subscribeProgramPreferencesDenial,
} from "../utils/program-preferences-session-state";

export const programPreferencesQueryKey = (userId: string | undefined, epoch: number) =>
  ["partners", "own-program-preferences", userId ?? "anonymous", epoch] as const;

export function useProgramPreferencesSession(
  queryKeyFor: (
    userId: string | undefined,
    epoch: number,
  ) => readonly unknown[] = programPreferencesQueryKey,
) {
  const { auth } = useAuth();
  const client = useQueryClient();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;
  const epoch = adminReadSessionEpoch(accessToken);
  const current = useRef({ userId, epoch });
  current.current = { userId, epoch };
  useSyncExternalStore(
    subscribeProgramPreferencesDenial,
    programPreferencesDenialSnapshot,
    serverProgramPreferencesDenialSnapshot,
  );
  useSyncExternalStore(
    subscribeAdminReadDenial,
    getAdminReadDenialSnapshot,
    getServerAdminReadDenialSnapshot,
  );
  const sharedDenial = adminReadDenialFor(userId, accessToken);
  const denied =
    getHttpStatus(sharedDenial) === 401 ? sharedDenial : getProgramPreferencesDenial(userId, epoch);
  const queryKey = queryKeyFor(userId, epoch);
  useEffect(() => {
    if (!denied) return;
    const deniedKey = queryKeyFor(userId, epoch);
    void client.cancelQueries({ queryKey: deniedKey });
    client.removeQueries({ queryKey: deniedKey });
  }, [client, userId, epoch, denied, queryKeyFor]);

  function assertCurrent(signal: AbortSignal) {
    if (
      typeof window === "undefined" ||
      !userId ||
      !accessToken ||
      denied ||
      signal.aborted ||
      tokenStore.get() !== accessToken ||
      current.current.userId !== userId ||
      current.current.epoch !== epoch ||
      getProgramPreferencesDenial(userId, epoch) ||
      getHttpStatus(adminReadDenialFor(userId, accessToken)) === 401
    )
      throw new CancelledError({ silent: true });
  }

  return {
    userId,
    epoch,
    denied,
    queryKey,
    assertCurrent,
    enabled: Boolean(typeof window !== "undefined" && userId && accessToken && !denied),
    async read<T>(signal: AbortSignal, request: (token: string) => Promise<T>): Promise<T> {
      assertCurrent(signal);
      try {
        const result = await request(accessToken as string);
        assertCurrent(signal);
        return result;
      } catch (error) {
        assertCurrent(signal);
        const status = getHttpStatus(error);
        if (status === 401 || status === 403) {
          const failure = error instanceof Error ? error : new Error("Partners access denied");
          denyProgramPreferencesSession(userId as string, epoch, failure);
          if (status === 401)
            denyAdminReadSession(userId as string, accessToken as string, failure);
          void client.cancelQueries({ queryKey });
          client.removeQueries({ queryKey });
        }
        throw error;
      }
    },
  };
}
