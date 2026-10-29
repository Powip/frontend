"use client";

import { CancelledError, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { requestResendInvitation } from "../api/admin-invitations.api";
import { partnersKeys } from "../keys/partners.keys";
import { invitationResendCommandSchema } from "../schemas/admin-invitations.schema";
import {
  inviteAdminPartnerSchema,
  type InviteAdminPartnerFormValues,
} from "../schemas/invite-admin-partner.schema";
import { inviteAdminPartner } from "../services/invite-admin-partner";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { useAdminCapabilitySession } from "./use-admin-capability-session";

export type InvitationWriteInput =
  | { operation: "create"; form: InviteAdminPartnerFormValues }
  | { operation: "resend"; invitationId: string; command: { reason: string } };

export function useInviteAdminPartner() {
  const session = useAdminCapabilitySession("PARTNERS_APPROVE", "invitations");
  const client = useQueryClient();
  const controllers = useRef(new Map<AbortController, number>());
  const epoch = session.epoch;
  const denied = session.denied;
  useEffect(() => {
    const pending = controllers.current;
    if (denied)
      pending.forEach((value, controller) => {
        if (value === epoch) controller.abort();
      });
    return () =>
      pending.forEach((value, controller) => {
        if (value === epoch) {
          controller.abort();
          pending.delete(controller);
        }
      });
  }, [epoch, denied]);
  const mutation = useMutation({
    mutationKey: [...session.familyKey, "session", epoch, "invitation-write"],
    mutationFn: async ({ input, epoch }: { input: InvitationWriteInput; epoch: number }) => {
      if (epoch !== session.epoch) throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, epoch);
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const command =
            input.operation === "create"
              ? inviteAdminPartnerSchema.parse(input.form)
              : invitationResendCommandSchema.parse(input.command);
          const key = await resolveAdminCommandIdempotencyKey(
            session.userId as string,
            input.operation === "create"
              ? "invitation.create"
              : `invitation.resend:${input.invitationId}`,
            command,
          );
          session.assertCurrent(controller.signal);
          if (input.operation === "create")
            return inviteAdminPartner(command as InviteAdminPartnerFormValues, {
              accessToken,
              idempotencyKey: key,
              signal: controller.signal,
            });
          return requestResendInvitation({
            accessToken,
            invitationId: input.invitationId,
            command: invitationResendCommandSchema.parse(command),
            idempotencyKey: key,
            signal: controller.signal,
          });
        });
      } finally {
        controllers.current.delete(controller);
      }
    },
    retry: false,
    onSuccess: (_result, variables) => {
      if (variables.epoch !== session.epoch) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      void client.invalidateQueries({ queryKey: partnersKeys.adminRead(session.userId) });
    },
  });
  return {
    session,
    mutation,
    mutationForSession: mutation.variables?.epoch === session.epoch,
    write: (input: InvitationWriteInput) => mutation.mutate({ input, epoch: session.epoch }),
  };
}
