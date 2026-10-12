"use client";

import { CancelledError, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { requestReferralRejection } from "../api/referral-rejection.api";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import {
  type ReferralRejectionCommand,
  referralRejectionCommandSchema,
} from "../schemas/referral-rejection.schema";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { useAdminCapabilitySession } from "./use-admin-capability-session";

export interface ReferralRejectionInput {
  referralId: string;
  command: ReferralRejectionCommand;
}
interface Owner {
  userId: string | undefined;
  epoch: number;
}
interface Attempt extends Owner {
  input: ReferralRejectionInput;
}

export function useReferralRejection() {
  const session = useAdminCapabilitySession("PARTNERS_RESOLVE_REFERRAL", "reviews");
  const client = useQueryClient();
  const controllers = useRef(new Map<AbortController, Owner>());
  const epoch = session.epoch;
  const userId = session.userId;
  const blocked = !session.enabled;
  useEffect(() => {
    const pending = controllers.current;
    if (blocked)
      pending.forEach((owner, controller) => {
        if (owner.epoch === epoch && owner.userId === userId) controller.abort();
      });
    return () =>
      pending.forEach((owner, controller) => {
        if (owner.epoch === epoch && owner.userId === userId) {
          controller.abort();
          pending.delete(controller);
        }
      });
  }, [epoch, userId, blocked]);

  function assertOwner(owner: Owner) {
    if (owner.epoch !== session.epoch || owner.userId !== session.userId)
      throw new CancelledError({ silent: true });
    session.assertCurrent(new AbortController().signal);
  }
  const mutation = useMutation({
    mutationKey: [...session.familyKey, "session", epoch, "reject-write"],
    mutationFn: async ({ input, epoch, userId }: Attempt) => {
      assertOwner({ epoch, userId });
      const controller = new AbortController();
      controllers.current.set(controller, { epoch, userId });
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const command = referralRejectionCommandSchema.parse(input.command);
          const idempotencyKey = await resolveAdminCommandIdempotencyKey(
            userId as string,
            `referral.reject:${input.referralId}`,
            command,
          );
          session.assertCurrent(controller.signal);
          return requestReferralRejection({
            accessToken,
            referralId: input.referralId,
            command,
            idempotencyKey,
            signal: controller.signal,
          });
        });
      } finally {
        controllers.current.delete(controller);
      }
    },
    retry: false,
    gcTime: 0,
    onSuccess: (_result, variables) => {
      try {
        assertOwner(variables);
      } catch {
        return;
      }
      // Refresh persisted facts, not a speculative local decision, identity or eligibility.
      void client.invalidateQueries({ queryKey: partnersKeys.adminRead(userId) });
    },
    onError: (error, variables) => {
      try {
        assertOwner(variables);
      } catch {
        return;
      }
      if (getHttpStatus(error) === 409)
        void client.invalidateQueries({ queryKey: partnersKeys.adminRead(userId) });
    },
  });
  const belongsToSession =
    mutation.variables?.epoch === epoch && mutation.variables?.userId === userId;
  return {
    session,
    mutation,
    mutationForSession: belongsToSession,
    async write(input: ReferralRejectionInput) {
      const owner = { epoch, userId };
      assertOwner(owner);
      try {
        const result = await mutation.mutateAsync({ input, ...owner });
        assertOwner(owner);
        return result;
      } catch (error) {
        assertOwner(owner);
        throw error;
      }
    },
  };
}
