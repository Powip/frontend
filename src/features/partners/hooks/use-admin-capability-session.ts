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

export type AdminPartnersCapability =
  | "PARTNERS_CONFIGURE_POLICY"
  | "PARTNERS_MANAGE_RESOURCES"
  | "PARTNERS_MANAGE_PARTNERS"
  | "PARTNERS_RESOLVE_REFERRAL";

export function useAdminCapabilitySession(
  capability: AdminPartnersCapability,
  family: "policy" | "resources" | "partners" | "reviews",
) {
  const { auth } = useAuth();
  const client = useQueryClient();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;
  const epoch = adminReadSessionEpoch(accessToken);
  const canAccess = Boolean(userId && accessToken && auth?.user.permissions?.includes(capability));
  const current = useRef({ userId, accessToken, epoch, canAccess });
  current.current = { userId, accessToken, epoch, canAccess };
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
  const readDenial = adminReadDenialFor(userId, accessToken);
  const globalDenial = getHttpStatus(readDenial) === 401 ? readDenial : null;
  const denied = globalDenial ?? getAdminCapabilityDenial(family, userId, epoch);
  const familyKey = [...partnersKeys.user(userId), `admin-${family}-v1`] as const;
  useEffect(() => {
    if (!globalDenial) return;
    const key = [...partnersKeys.user(userId), `admin-${family}-v1`] as const;
    void client.cancelQueries({ queryKey: key });
    client.removeQueries({ queryKey: key });
  }, [client, family, userId, globalDenial]);

  function assertCurrent(signal: AbortSignal) {
    if (
      typeof window === "undefined" ||
      !canAccess ||
      !userId ||
      !accessToken ||
      denied ||
      tokenStore.get() !== accessToken ||
      signal.aborted ||
      current.current.epoch !== epoch ||
      current.current.userId !== userId ||
      !current.current.canAccess ||
      getAdminCapabilityDenial(family, userId, epoch) ||
      getHttpStatus(adminReadDenialFor(userId, accessToken)) === 401
    )
      throw new CancelledError({ silent: true });
  }

  return {
    userId,
    epoch,
    canAccess,
    denied,
    familyKey,
    enabled: Boolean(typeof window !== "undefined" && canAccess && !denied),
    assertCurrent,
    async read<T>(signal: AbortSignal, request: (token: string) => Promise<T>): Promise<T> {
      assertCurrent(signal);
      try {
        const result = await request(accessToken as string);
        assertCurrent(signal);
        return result;
      } catch (error) {
        assertCurrent(signal);
        const status = getHttpStatus(error);
        if (status === 401) {
          const failure = error instanceof Error ? error : new Error("Partners session revoked");
          denyAdminReadSession(userId as string, accessToken as string, failure);
          denyAdminCapability("policy", userId as string, epoch, failure);
          denyAdminCapability("resources", userId as string, epoch, failure);
          denyAdminCapability("partners", userId as string, epoch, failure);
          denyAdminCapability("reviews", userId as string, epoch, failure);
          for (const key of [
            partnersKeys.adminRead(userId),
            [...partnersKeys.user(userId), "admin-policy-v1"],
            [...partnersKeys.user(userId), "admin-resources-v1"],
            [...partnersKeys.user(userId), "admin-partners-v1"],
            [...partnersKeys.user(userId), "admin-reviews-v1"],
          ]) {
            void client.cancelQueries({ queryKey: key });
            client.removeQueries({ queryKey: key });
          }
        } else if (status === 403) {
          denyAdminCapability(
            family,
            userId as string,
            epoch,
            error instanceof Error ? error : new Error("Partners access denied"),
          );
          void client.cancelQueries({ queryKey: familyKey });
          client.removeQueries({ queryKey: familyKey });
        }
        throw error;
      }
    },
  };
}
