"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import {
  cancelBroadcast,
  countAudience,
  createBroadcast,
  createFollowupRule,
  crmError,
  deleteBroadcast,
  deleteFollowupRule,
  getFollowupStats,
  listBroadcasts,
  listFollowupRules,
  listFollowupRuns,
  listTemplates,
  pauseBroadcast,
  resumeBroadcast,
  sendBroadcast,
  updateBroadcast,
  updateFollowupRule,
} from "@/services/crmService";
import type {
  Audience,
  Broadcast,
  BroadcastInput,
  FollowupRule,
  FollowupRuleInput,
} from "@/types/crm";

const onError = (err: unknown) => toast.error(crmError(err).message);

// --- Plantillas ---

/** Si WhatsApp no responde (502 TEMPLATES_UNAVAILABLE) el error queda en la query. */
export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: crmKeys.templates,
    queryFn: listTemplates,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

// --- Seguimientos ---

export function useFollowupRules() {
  return useQuery({ queryKey: crmKeys.followupRules, queryFn: listFollowupRules, retry: false });
}

export function useFollowupRuns() {
  return useQuery({
    queryKey: crmKeys.followupRuns,
    queryFn: listFollowupRuns,
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useFollowupStats() {
  return useQuery({
    queryKey: crmKeys.followupStats,
    queryFn: getFollowupStats,
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useFollowupRuleMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: crmKeys.followupRules });
  return {
    create: useMutation({
      mutationFn: (input: FollowupRuleInput) => createFollowupRule(input),
      onSuccess: refresh,
      onError,
    }),
    /** Crea varias reglas seguidas (secuencias rápidas). */
    createMany: useMutation({
      mutationFn: async (inputs: FollowupRuleInput[]) => {
        const created: FollowupRule[] = [];
        for (const input of inputs) created.push(await createFollowupRule(input));
        return created;
      },
      onSettled: refresh,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<FollowupRuleInput> }) =>
        updateFollowupRule(id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFollowupRule(id),
      onSuccess: refresh,
      onError,
    }),
  };
}

// --- Difusiones ---

export function useBroadcasts() {
  return useQuery({ queryKey: crmKeys.broadcasts, queryFn: listBroadcasts, retry: false });
}

/** Cuenta quiénes recibirían la difusión (ya sin quienes pidieron la baja). */
export function useAudienceCount(audience: Audience | null) {
  return useQuery({
    queryKey: [...crmKeys.broadcasts, "audience-count", audience] as const,
    queryFn: () => countAudience(audience!),
    enabled: !!audience,
    retry: false,
  });
}

export function useBroadcastMutations() {
  const qc = useQueryClient();
  const upsert = (b: Broadcast) =>
    qc.setQueryData<Broadcast[]>(crmKeys.broadcasts, (old) =>
      old
        ? old.some((x) => x.id === b.id)
          ? old.map((x) => (x.id === b.id ? b : x))
          : [b, ...old]
        : old,
    );
  const refresh = () =>
    qc.invalidateQueries({ queryKey: crmKeys.broadcasts, exact: true });
  const after = (b: Broadcast) => {
    upsert(b);
    refresh();
  };
  return {
    create: useMutation({
      mutationFn: (input: BroadcastInput) => createBroadcast(input),
      onSuccess: after,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<BroadcastInput> }) =>
        updateBroadcast(id, input),
      onSuccess: after,
      onError,
    }),
    send: useMutation({
      mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string }) =>
        sendBroadcast(id, scheduledAt),
      onSuccess: after,
      onError,
    }),
    pause: useMutation({ mutationFn: (id: string) => pauseBroadcast(id), onSuccess: after, onError }),
    resume: useMutation({ mutationFn: (id: string) => resumeBroadcast(id), onSuccess: after, onError }),
    cancel: useMutation({ mutationFn: (id: string) => cancelBroadcast(id), onSuccess: after, onError }),
    remove: useMutation({
      mutationFn: (id: string) => deleteBroadcast(id),
      onSuccess: refresh,
      onError,
    }),
  };
}
