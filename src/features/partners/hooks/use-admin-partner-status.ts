"use client";

import { CancelledError, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { requestAdminPartnerStatus } from "../api/admin-partner-status.api";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import {
  type AdminPartnerStatusCommand,
  type AdminPartnerStatusOperation,
  adminPartnerStatusCommandSchema,
  adminPartnerStatusOperationSchema,
} from "../schemas/admin-partner-status.schema";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { useAdminCapabilitySession } from "./use-admin-capability-session";

export interface AdminPartnerStatusInput {
  partnerId: string;
  operation: AdminPartnerStatusOperation;
  command: AdminPartnerStatusCommand;
}

export function useAdminPartnerStatus() {
  const session = useAdminCapabilitySession("PARTNERS_MANAGE_PARTNERS", "partners");
  const client = useQueryClient();
  const controllers = useRef(new Map<AbortController, number>());
  const epoch = session.epoch;
  const denied = session.denied;
  useEffect(() => {
    const pending = controllers.current;
    if (denied)
      pending.forEach((pendingEpoch, controller) => {
        if (pendingEpoch === epoch) controller.abort();
      });
    return () => {
      pending.forEach((pendingEpoch, controller) => {
        if (pendingEpoch === epoch) {
          controller.abort();
          pending.delete(controller);
        }
      });
    };
  }, [epoch, denied]);

  const mutation = useMutation({
    mutationKey: [...session.familyKey, "session", epoch, "status-write"],
    mutationFn: async ({ input, epoch }: { input: AdminPartnerStatusInput; epoch: number }) => {
      if (epoch !== session.epoch) throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, epoch);
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const command = adminPartnerStatusCommandSchema.parse(input.command);
          const operation = adminPartnerStatusOperationSchema.parse(input.operation);
          const idempotencyKey = await resolveAdminCommandIdempotencyKey(
            session.userId as string,
            `partner.${operation}:${input.partnerId}`,
            command,
          );
          session.assertCurrent(controller.signal);
          return requestAdminPartnerStatus({
            accessToken,
            partnerId: input.partnerId,
            operation,
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
    onSuccess: (_result, variables) => {
      if (variables.epoch !== session.epoch) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      // Refresh the actual detail, list, dashboard and activity; never invent a local state transition.
      void client.invalidateQueries({ queryKey: partnersKeys.adminRead(session.userId) });
    },
    onError: (error, variables) => {
      if (variables.epoch !== session.epoch) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      if (getHttpStatus(error) === 409)
        void client.invalidateQueries({ queryKey: partnersKeys.adminRead(session.userId) });
    },
  });

  return {
    session,
    mutation,
    mutationForSession: mutation.variables?.epoch === session.epoch,
    write: (input: AdminPartnerStatusInput) => mutation.mutate({ input, epoch: session.epoch }),
  };
}
