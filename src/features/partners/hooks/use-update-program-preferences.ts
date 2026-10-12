"use client";

import { CancelledError, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { requestUpdateProgramPreferences } from "../api/program-preferences.api";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import type {
  ProgramPreferencesCommand,
  ProgramPreferencesResponse,
} from "../models/program-preferences";
import { programPreferencesCommandSchema } from "../schemas/program-preferences.schema";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { partnersMutationErrorMessage } from "../utils/unavailable-partners-feature";
import { useProgramPreferencesSession } from "./use-program-preferences-session";

export function useUpdateProgramPreferences() {
  const session = useProgramPreferencesSession();
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
      command: Readonly<ProgramPreferencesCommand>;
      epoch: number;
      userId: string | undefined;
    }) => {
      if (epoch !== session.epoch || userId !== session.userId)
        throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, { epoch, userId });
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const parsed = programPreferencesCommandSchema.parse(command);
          const idempotencyKey = await resolveAdminCommandIdempotencyKey(
            userId as string,
            "program-preferences.save",
            parsed,
          );
          session.assertCurrent(controller.signal);
          return requestUpdateProgramPreferences({
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
    onSuccess: (response, variables) => {
      if (variables.epoch !== session.epoch || variables.userId !== session.userId) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      client.setQueryData<ProgramPreferencesResponse>(session.queryKey, (current) =>
        current?.settings &&
        response.settings &&
        current.settings.version > response.settings.version
          ? current
          : response,
      );
      // The immutable receipt may be older than a later read; never downgrade that read.
      void client.invalidateQueries({ queryKey: session.queryKey });
      toast.success("Preferencias guardadas. Esto no activa condiciones ni aplica descuentos.");
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
      toast.error(partnersMutationErrorMessage(error, "No pudimos confirmar tus preferencias."));
    },
  });
  const mutationForSession = Boolean(
    session.enabled &&
      mutation.variables?.epoch === session.epoch &&
      mutation.variables?.userId === session.userId,
  );
  return {
    session,
    mutation,
    mutationForSession,
    save: (command: Readonly<ProgramPreferencesCommand>) =>
      mutation.mutate({ command, epoch: session.epoch, userId: session.userId }),
  };
}
