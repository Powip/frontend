"use client";

import { CancelledError, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import {
  adminCapabilityDenialSnapshot,
  denyAdminCapability,
  getAdminCapabilityDenial,
  serverAdminCapabilityDenialSnapshot,
  subscribeAdminCapabilityDenial,
} from "../utils/admin-capability-session-state";
import {
  adminReadDenialFor,
  adminReadSessionEpoch,
  denyAdminReadSession,
  getAdminReadDenialSnapshot,
  getServerAdminReadDenialSnapshot,
  subscribeAdminReadDenial,
} from "../utils/admin-read-session-state";

export function usePayoutSettingsSession() {
  const { auth } = useAuth();
  const client = useQueryClient();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;
  const epoch = adminReadSessionEpoch(accessToken);
  const current = useRef({ userId, epoch });
  current.current = { userId, epoch };
  useSyncExternalStore(
    subscribeAdminCapabilityDenial,
    adminCapabilityDenialSnapshot,
    serverAdminCapabilityDenialSnapshot,
  );
  useSyncExternalStore(
    subscribeAdminReadDenial,
    getAdminReadDenialSnapshot,
    getServerAdminReadDenialSnapshot,
  );
  const sharedDenial = adminReadDenialFor(userId, accessToken);
  const globallyRevoked = getHttpStatus(sharedDenial) === 401;
  const denied = globallyRevoked ? sharedDenial : getAdminCapabilityDenial("payout", userId, epoch);
  const queryKey = partnersKeys.payoutSettings(userId, epoch);
  useEffect(() => {
    if (!globallyRevoked) return;
    const revokedKey = partnersKeys.payoutSettings(userId, epoch);
    void client.cancelQueries({ queryKey: revokedKey });
    client.removeQueries({ queryKey: revokedKey });
  }, [client, userId, epoch, globallyRevoked]);
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
      getAdminCapabilityDenial("payout", userId, epoch) ||
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
          denyAdminCapability("payout", userId as string, epoch, failure);
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
