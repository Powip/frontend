"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import { crmError } from "@/services/crmService";
import { createCall, deleteCall, getCallStats, listCalls } from "@/services/crmCallsService";
import type { CallDays, CallListParams, CreateCallInput } from "@/types/crmCalls";

export const callKeys = {
  all: ["crm", "calls"] as const,
  list: (p: CallListParams) => ["crm", "calls", "list", p] as const,
  stats: (days: number) => ["crm", "calls", "stats", days] as const,
};

export function useCalls(params: CallListParams, enabled = true) {
  return useQuery({
    queryKey: callKeys.list(params),
    queryFn: () => listCalls(params),
    enabled,
    retry: false,
  });
}

export function useCallStats(days: CallDays) {
  return useQuery({
    queryKey: callKeys.stats(days),
    queryFn: () => getCallStats(days),
    retry: false,
  });
}

export function useCallMutations() {
  const qc = useQueryClient();
  const onError = (err: unknown) => toast.error(crmError(err).message);
  return {
    create: useMutation({
      mutationFn: (input: CreateCallInput) => createCall(input),
      onSuccess: (call) => {
        qc.invalidateQueries({ queryKey: callKeys.all });
        // «Volver a llamar» crea una tarea; con chat deja una nota en la conversación.
        qc.invalidateQueries({ queryKey: crmKeys.tasks });
        if (call.conversationId) {
          qc.invalidateQueries({ queryKey: crmKeys.messages(call.conversationId) });
        }
        toast.success("Llamada registrada");
      },
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteCall(id),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: callKeys.all });
        toast.success("Llamada eliminada");
      },
      onError,
    }),
  };
}
