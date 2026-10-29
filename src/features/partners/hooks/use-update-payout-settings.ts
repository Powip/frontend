"use client";
import { CancelledError, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import type { PayoutSettings } from "../models/payout-settings";
import type { PayoutSettingsCommand } from "../schemas/update-payout-settings.schema";
import { payoutSettingsCommandSchema } from "../schemas/update-payout-settings.schema";
import { updatePayoutSettings } from "../services/update-payout-settings";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { partnersMutationErrorMessage } from "../utils/unavailable-partners-feature";
import { usePayoutSettingsSession } from "./use-payout-settings-session";

export function useUpdatePayoutSettings() {
  const session = usePayoutSettingsSession();
  const client = useQueryClient();
  const controllers = useRef(
    new Map<AbortController, { epoch: number; userId: string | undefined }>(),
  );
  const epoch = session.epoch;
  const userId = session.userId;
  useEffect(() => {
    const pending = controllers.current;
    if (session.denied)
      pending.forEach((owner, controller) => {
        if (owner.epoch === epoch && owner.userId === userId) controller.abort();
      });
    return () => {
      pending.forEach((owner, controller) => {
        if (owner.epoch === epoch && owner.userId === userId) {
          controller.abort();
          pending.delete(controller);
        }
      });
    };
  }, [epoch, userId, session.denied]);
  const mutation = useMutation({
    mutationKey: [...session.queryKey, "write"],
    retry: false,
    gcTime: 0,
    mutationFn: async ({
      command,
      epoch,
      userId,
    }: {
      command: PayoutSettingsCommand;
      epoch: number;
      userId: string | undefined;
    }) => {
      if (epoch !== session.epoch || userId !== session.userId)
        throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, { epoch, userId });
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const parsed = payoutSettingsCommandSchema.parse(command);
          const idempotencyKey = await resolveAdminCommandIdempotencyKey(
            session.userId as string,
            "payout-settings.save",
            parsed,
          );
          session.assertCurrent(controller.signal);
          return updatePayoutSettings({
            accessToken,
            signal: controller.signal,
            command: parsed,
            idempotencyKey,
          });
        });
      } finally {
        controllers.current.delete(controller);
      }
    },
    onSuccess: (settings, variables) => {
      if (variables.epoch !== session.epoch || variables.userId !== session.userId) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      client.setQueryData<PayoutSettings | null>(session.queryKey, (current) =>
        current && current.version > settings.version ? current : settings,
      );
      // A replay returns its original immutable receipt, not necessarily the latest account version.
      void client.invalidateQueries({ queryKey: session.queryKey });
      toast.success("Datos de cobro actualizados. Esto no ejecuta un pago.");
    },
    onError: (error, variables) => {
      if (
        variables.epoch !== session.epoch ||
        variables.userId !== session.userId ||
        error instanceof CancelledError
      )
        return;
      if (getHttpStatus(error) === 409)
        void client.invalidateQueries({ queryKey: session.queryKey });
      toast.error(
        partnersMutationErrorMessage(
          error,
          "No pudimos actualizar tus datos de cobro. Reintentá la misma solicitud o recargá si cambió la versión.",
        ),
      );
    },
  });
  const belongsToSession =
    mutation.variables?.epoch === session.epoch &&
    mutation.variables?.userId === session.userId &&
    !session.denied;
  return {
    ...mutation,
    data: belongsToSession ? mutation.data : undefined,
    isPending: belongsToSession && mutation.isPending,
    mutate: (command: PayoutSettingsCommand, options?: { onSuccess?: () => void }) =>
      mutation.mutate(
        { command, epoch: session.epoch, userId: session.userId },
        {
          onSuccess: () => {
            try {
              session.assertCurrent(new AbortController().signal);
              options?.onSuccess?.();
            } catch {
              /* stale session */
            }
          },
        },
      ),
  };
}
