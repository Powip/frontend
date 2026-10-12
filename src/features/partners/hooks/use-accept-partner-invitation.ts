"use client";

import { CancelledError, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { requestAcceptInvitation } from "../api/admin-invitations.api";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import { invitationTokenSchema } from "../schemas/admin-invitations.schema";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { adminReadSessionEpoch } from "../utils/admin-read-session-state";

export function useAcceptPartnerInvitation() {
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;
  const epoch = adminReadSessionEpoch(accessToken);
  const current = useRef({ userId, epoch });
  current.current = { userId, epoch };
  const controllers = useRef(new Map<AbortController, number>());
  const [deniedAt, setDeniedAt] = useState<number | null>(null);
  const enabled = Boolean(
    typeof window !== "undefined" && userId && accessToken && deniedAt !== epoch,
  );
  function assertCurrent(signal: AbortSignal) {
    if (
      !enabled ||
      !userId ||
      !accessToken ||
      signal.aborted ||
      tokenStore.get() !== accessToken ||
      current.current.userId !== userId ||
      current.current.epoch !== epoch
    )
      throw new CancelledError({ silent: true });
  }
  useEffect(() => {
    const pending = controllers.current;
    return () =>
      pending.forEach((value, controller) => {
        if (value === epoch) {
          controller.abort();
          pending.delete(controller);
        }
      });
  }, [epoch]);
  const mutation = useMutation({
    mutationKey: [...partnersKeys.user(userId), "invitation-accept-v1", epoch],
    mutationFn: async ({ token, epoch: initiatedEpoch }: { token: string; epoch: number }) => {
      if (initiatedEpoch !== epoch) throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, epoch);
      try {
        assertCurrent(controller.signal);
        const canonical = invitationTokenSchema.parse(token);
        const key = await resolveAdminCommandIdempotencyKey(userId as string, "invitation.accept", {
          token: canonical,
        });
        assertCurrent(controller.signal);
        const receipt = await requestAcceptInvitation({
          accessToken: accessToken as string,
          token: canonical,
          idempotencyKey: key,
          signal: controller.signal,
        });
        assertCurrent(controller.signal);
        return receipt;
      } catch (error) {
        assertCurrent(controller.signal);
        if ([401, 403].includes(getHttpStatus(error) ?? 0)) setDeniedAt(epoch);
        throw error;
      } finally {
        controllers.current.delete(controller);
      }
    },
    retry: false,
  });
  return {
    userId,
    epoch,
    enabled,
    mutation,
    mutationForSession: mutation.variables?.epoch === epoch,
    accept: (token: string) => mutation.mutate({ token, epoch }),
  };
}
