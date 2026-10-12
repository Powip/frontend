"use client";

import { CancelledError, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import {
  adminReadDenialFor,
  adminReadSessionEpoch,
  denyAdminReadSession,
  getAdminReadDenialSnapshot,
  getServerAdminReadDenialSnapshot,
  subscribeAdminReadDenial,
} from "../utils/admin-read-session-state";

function useAdminReadAuthorization() {
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;
  useSyncExternalStore(
    subscribeAdminReadDenial,
    getAdminReadDenialSnapshot,
    getServerAdminReadDenialSnapshot,
  );
  const denied = adminReadDenialFor(userId, accessToken);
  const canView = Boolean(
    userId && accessToken && auth?.user.permissions?.includes("PARTNERS_VIEW"),
  );
  return { userId, accessToken, canView, denied };
}

export function useAdminReadAccess() {
  const { canView, denied } = useAdminReadAuthorization();
  return { canView, denied };
}

export function useAdminReadSession(enabled = true) {
  const { userId, accessToken, canView, denied } = useAdminReadAuthorization();
  const queryClient = useQueryClient();
  const epoch = adminReadSessionEpoch(accessToken);
  const sessionDenied = Boolean(denied);
  useEffect(() => {
    if (!sessionDenied || epoch === 0) return;
    // A 401 can originate in an own-Partner reader, not only an admin read.
    // Shared VIEW denial also cancels pending siblings and removes every private admin projection.
    const key = partnersKeys.adminRead(userId);
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.removeQueries({ queryKey: key });
  }, [queryClient, userId, epoch, sessionDenied]);

  return {
    userId,
    canView,
    denied,
    epoch,
    enabled: Boolean(typeof window !== "undefined" && enabled && canView && !denied),
    async read<T>(signal: AbortSignal, request: (accessToken: string) => Promise<T>): Promise<T> {
      if (
        typeof window === "undefined" ||
        !canView ||
        !userId ||
        !accessToken ||
        adminReadDenialFor(userId, accessToken) ||
        tokenStore.get() !== accessToken ||
        signal.aborted
      ) {
        throw new CancelledError({ silent: true });
      }
      try {
        const result = await request(accessToken);
        if (
          tokenStore.get() !== accessToken ||
          signal.aborted ||
          adminReadDenialFor(userId, accessToken)
        ) {
          throw new CancelledError({ silent: true });
        }
        return result;
      } catch (error) {
        // A stale success or failure must never deny or populate the next session.
        if (tokenStore.get() !== accessToken || signal.aborted)
          throw new CancelledError({ silent: true });
        const status = getHttpStatus(error);
        if (status === 401 || status === 403) {
          denyAdminReadSession(
            userId,
            accessToken,
            error instanceof Error ? error : new Error("Partners access denied"),
          );
          void queryClient.cancelQueries({ queryKey: partnersKeys.adminRead(userId) });
          queryClient.removeQueries({ queryKey: partnersKeys.adminRead(userId) });
        }
        throw error;
      }
    },
  };
}
