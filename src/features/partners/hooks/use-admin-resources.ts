"use client";

import {
  CancelledError,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  requestAdminResources,
  requestCreateAdminResource,
  requestReviseAdminResource,
  requestTransitionAdminResource,
} from "../api/admin-resources.api";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import type {
  AdminResourceMetadataCommand,
  AdminResourceRevisionCommand,
  AdminResourceTransition,
  AdminResourceTransitionCommand,
} from "../models/admin-resource";
import {
  adminResourceMetadataCommandSchema,
  adminResourceRevisionCommandSchema,
  adminResourceTransitionCommandSchema,
} from "../schemas/admin-resources.schema";
import { resolveAdminCommandIdempotencyKey } from "../utils/admin-command-idempotency";
import { useAdminCapabilitySession } from "./use-admin-capability-session";

export type AdminResourceOperation =
  | { operation: "create"; command: AdminResourceMetadataCommand }
  | { operation: "revise"; resourceId: string; command: AdminResourceRevisionCommand }
  | {
      operation: AdminResourceTransition;
      resourceId: string;
      command: AdminResourceTransitionCommand;
    };

export function useAdminResources(limit = 20) {
  const session = useAdminCapabilitySession("PARTNERS_MANAGE_RESOURCES", "resources");
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
    queryKey: [...session.familyKey, "session", session.epoch, "list", limit],
    queryFn: ({ pageParam, signal }) =>
      session.read(signal, (accessToken) =>
        requestAdminResources({ accessToken, cursor: pageParam, limit, signal }),
      ),
    enabled: session.enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
  const mutation = useMutation({
    mutationKey: [...session.familyKey, "session", session.epoch, "write"],
    mutationFn: async ({ input, epoch }: { input: AdminResourceOperation; epoch: number }) => {
      if (epoch !== session.epoch) throw new CancelledError({ silent: true });
      const controller = new AbortController();
      controllers.current.set(controller, epoch);
      try {
        return await session.read(controller.signal, async (accessToken) => {
          const command =
            input.operation === "create"
              ? adminResourceMetadataCommandSchema.parse(input.command)
              : input.operation === "revise"
                ? adminResourceRevisionCommandSchema.parse(input.command)
                : adminResourceTransitionCommandSchema.parse(input.command);
          const operation = `resource.${input.operation}:${"resourceId" in input ? input.resourceId : "collection"}`;
          const idempotencyKey = await resolveAdminCommandIdempotencyKey(
            session.userId as string,
            operation,
            command,
          );
          session.assertCurrent(controller.signal);
          const base = { accessToken, idempotencyKey, signal: controller.signal };
          if (input.operation === "create")
            return requestCreateAdminResource({
              ...base,
              command: command as AdminResourceMetadataCommand,
            });
          if (input.operation === "revise")
            return requestReviseAdminResource({
              ...base,
              resourceId: input.resourceId,
              command: command as AdminResourceRevisionCommand,
            });
          return requestTransitionAdminResource({
            ...base,
            resourceId: input.resourceId,
            transition: input.operation,
            command: command as AdminResourceTransitionCommand,
          });
        });
      } finally {
        controllers.current.delete(controller);
      }
    },
    retry: false,
    onSuccess: (_resource, variables) => {
      if (variables.epoch !== session.epoch) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      void client.invalidateQueries({ queryKey: session.familyKey });
      void client.invalidateQueries({ queryKey: ["partners", "resources-v2"] });
    },
    onError: (error, variables) => {
      if (variables.epoch !== session.epoch) return;
      try {
        session.assertCurrent(new AbortController().signal);
      } catch {
        return;
      }
      if (getHttpStatus(error) === 409)
        void client.invalidateQueries({ queryKey: session.familyKey });
    },
  });
  return {
    session,
    query,
    mutation,
    mutationForSession: mutation.variables?.epoch === session.epoch,
    write: (input: AdminResourceOperation) => mutation.mutate({ input, epoch: session.epoch }),
  };
}
