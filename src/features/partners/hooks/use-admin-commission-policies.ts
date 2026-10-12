"use client";

import {
  CancelledError,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  requestAdminCommissionPolicyVersions,
  requestCreateAdminCommissionPolicyDraft,
} from "../api/admin-commission-policy.api";
import type { AdminCommissionPolicyDraftCommand } from "../models/admin-commission-policy";
import { adminCommissionPolicyDraftCommandSchema } from "../schemas/admin-commission-policy.schema";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { useAdminCapabilitySession } from "./use-admin-capability-session";

export function useAdminCommissionPolicies(limit = 50) {
  const session = useAdminCapabilitySession("PARTNERS_CONFIGURE_POLICY", "policy");
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
  const query = useInfiniteQuery({
    queryKey: [...session.familyKey, "session", session.epoch, "versions", limit],
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        requestAdminCommissionPolicyVersions({ accessToken, cursor: pageParam, limit, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
  const creation = useMutation({
    mutationKey: [...session.familyKey, "session", session.epoch, "create-draft"],
    mutationFn: async ({
      command,
      epoch,
    }: {
      command: AdminCommissionPolicyDraftCommand;
      epoch: number;
    }) => {
      if (epoch !== session.epoch) throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, epoch);
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const payload = adminCommissionPolicyDraftCommandSchema.parse(command);
          const idempotencyKey = await resolveAdminCommandIdempotencyKey(
            session.userId as string,
            "commission-policy.create-draft",
            payload,
          );
          session.assertCurrent(controller.signal);
          return requestCreateAdminCommissionPolicyDraft({
            accessToken,
            command: payload,
            idempotencyKey,
            signal: controller.signal,
          });
        });
      } finally {
        controllers.current.delete(controller);
      }
    },
    retry: false,
    onSuccess: (_draft, variables) => {
      if (variables.epoch !== session.epoch) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      void client.invalidateQueries({ queryKey: session.familyKey });
    },
  });
  return {
    session,
    query,
    creation,
    createDraft: (command: AdminCommissionPolicyDraftCommand) =>
      creation.mutate({ command, epoch: session.epoch }),
    creationForSession: creation.variables?.epoch === session.epoch,
  };
}
