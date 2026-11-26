"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import { callKeys } from "@/hooks/useCrmCalls";
import { pipelineOf } from "@/lib/crmPipelines";
import {
  crmError,
  getConversation,
  listPipelines,
  sendMessage,
  updateConversation,
} from "@/services/crmService";
import {
  getCallPermission,
  getCallSessionStats,
  getCallsConfig,
  getLiveCalls,
  requestCallPermission,
  saveCallSessionResult,
} from "@/services/crmCallSessionsService";
import type { CallSessionDays, CallSessionResultInput } from "@/types/crmCallSessions";

export const callSessionKeys = {
  all: crmKeys.callSessions,
  live: ["crm", "call-sessions", "live"] as const,
  config: ["crm", "call-sessions", "config"] as const,
  stats: (days: number) => ["crm", "call-sessions", "stats", days] as const,
  permission: crmKeys.callPermission,
};

const LIVE_POLL_MS = 3000;

/** Llamadas sonando o en curso y las que esperan resultado. Se consulta cada 3 s. */
export function useLiveCalls(enabled = true) {
  return useQuery({
    queryKey: callSessionKeys.live,
    queryFn: getLiveCalls,
    enabled,
    retry: false,
    refetchInterval: enabled ? LIVE_POLL_MS : false,
    refetchIntervalInBackground: true,
  });
}

export function useCallsConfig() {
  return useQuery({
    queryKey: callSessionKeys.config,
    queryFn: getCallsConfig,
    retry: false,
    staleTime: 60_000,
    // El horario para llamar abre y cierra solo: se vuelve a consultar cada minuto.
    refetchInterval: 60_000,
  });
}

export function useCallSessionStats(days: CallSessionDays) {
  return useQuery({
    queryKey: callSessionKeys.stats(days),
    queryFn: () => getCallSessionStats(days),
    retry: false,
    refetchInterval: 15_000,
  });
}

export function useCallPermission(conversationId: string | null) {
  return useQuery({
    queryKey: callSessionKeys.permission(conversationId ?? ""),
    queryFn: () => getCallPermission(conversationId as string),
    enabled: !!conversationId,
    retry: false,
  });
}

export function useCallSessionMutations() {
  const qc = useQueryClient();
  const onError = (err: unknown) => toast.error(crmError(err).message);
  return {
    requestPermission: useMutation({
      mutationFn: (conversationId: string) => requestCallPermission(conversationId),
      onSuccess: (state, conversationId) => {
        qc.setQueryData(callSessionKeys.permission(conversationId), state);
        toast.success(
          state.canCall
            ? "El cliente ya dio permiso: puedes llamar."
            : "Pedido de permiso enviado por WhatsApp.",
        );
      },
      onError,
    }),
    saveResult: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CallSessionResultInput }) =>
        saveCallSessionResult(id, input),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: callSessionKeys.all });
        qc.invalidateQueries({ queryKey: callKeys.all });
        // «Volver a llamar» y «No contestó» crean tareas en la Agenda.
        qc.invalidateQueries({ queryKey: crmKeys.tasks });
        toast.success("Resultado guardado");
      },
      onError,
    }),
    sendToChat: useMutation({
      mutationFn: ({ conversationId, body }: ChatText) => sendMessage(conversationId, body),
      onSuccess: (_, { conversationId }) =>
        qc.invalidateQueries({ queryKey: crmKeys.messages(conversationId) }),
      onError,
    }),
    markLost: useMutation({
      mutationFn: ({ conversationId, lostReason }: LostChat) => moveToLost(conversationId, lostReason),
      onSuccess: (_, { conversationId }) => {
        qc.invalidateQueries({ queryKey: crmKeys.conversation(conversationId) });
        qc.invalidateQueries({ queryKey: crmKeys.conversations });
      },
      onError,
    }),
  };
}

interface ChatText {
  conversationId: string;
  body: string;
}

interface LostChat {
  conversationId: string;
  lostReason: string;
}

/** Mueve el chat a la etapa «perdida» de su embudo; si el embudo no tiene, no hace nada. */
async function moveToLost(conversationId: string, lostReason: string): Promise<void> {
  const [pipelines, conversation] = await Promise.all([listPipelines(), getConversation(conversationId)]);
  const stage = pipelineOf(pipelines, conversation)?.stages.find((s) => s.kind === "lost");
  if (stage && stage.id !== conversation.stageId) {
    await updateConversation(conversationId, { stageId: stage.id, lostReason });
  }
}
