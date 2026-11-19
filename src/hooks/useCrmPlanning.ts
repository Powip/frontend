"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import { moveInBoard } from "@/components/ventas-chat/board";
import {
  createPipeline,
  createStage,
  createTask,
  crmError,
  deletePipeline,
  deleteStage,
  deleteTask,
  getBoard,
  listPipelines,
  listTasks,
  renamePipeline,
  updateConversation,
  updateStage,
  updateTask,
} from "@/services/crmService";
import type {
  AssignedFilter,
  Board,
  Conversation,
  CreateTaskInput,
  Pipeline,
  StageInput,
  TaskListParams,
  UpdateStageInput,
  UpdateTaskInput,
} from "@/types/crm";

// --- Embudos ---

export function usePipelines() {
  return useQuery({
    queryKey: crmKeys.pipelines,
    queryFn: listPipelines,
    retry: false,
  });
}

export function useBoard(pipelineId: string | null, assigned: AssignedFilter) {
  return useQuery({
    queryKey: crmKeys.board(pipelineId ?? "", assigned),
    queryFn: () => getBoard(pipelineId!, assigned),
    enabled: !!pipelineId,
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export interface MoveInput {
  conversationId: string;
  stageId: string;
  lostReason?: string;
}

/**
 * Mueve una tarjeta de etapa. Optimista: la tarjeta cambia de columna al
 * instante; si el servicio falla se restaura el tablero y se avisa con un toast.
 */
export function useMoveCard(pipelineId: string | null, assigned: AssignedFilter) {
  const qc = useQueryClient();
  const key = crmKeys.board(pipelineId ?? "", assigned);
  return useMutation({
    mutationFn: ({ conversationId, stageId, lostReason }: MoveInput) =>
      updateConversation(conversationId, {
        stageId,
        ...(lostReason ? { lostReason } : {}),
      }),
    onMutate: async ({ conversationId, stageId }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Board>(key);
      if (previous) qc.setQueryData<Board>(key, moveInBoard(previous, conversationId, stageId));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData<Board>(key, ctx.previous);
      toast.error(crmError(err).message);
    },
    onSuccess: (conv) => {
      qc.setQueryData<Conversation>(crmKeys.conversation(conv.id), conv);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: crmKeys.boards });
      qc.invalidateQueries({ queryKey: crmKeys.conversations });
    },
  });
}

/** Reemplaza un embudo en la caché de la lista. */
function replacePipeline(list: Pipeline[] | undefined, p: Pipeline): Pipeline[] | undefined {
  return list?.map((x) => (x.id === p.id ? p : x));
}

/** Mutaciones del editor de embudos; los errores 409 muestran el mensaje del servicio. */
export function usePipelineMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: crmKeys.pipelines });
    qc.invalidateQueries({ queryKey: crmKeys.boards });
  };
  const onError = (err: unknown) => toast.error(crmError(err).message);
  const onPipeline = (p: Pipeline) => {
    qc.setQueryData<Pipeline[]>(crmKeys.pipelines, (old) => replacePipeline(old, p));
    refresh();
  };
  return {
    create: useMutation({
      mutationFn: (name: string) => createPipeline(name),
      onSuccess: refresh,
      onError,
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => renamePipeline(id, name),
      onSuccess: onPipeline,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deletePipeline(id),
      onSuccess: refresh,
      onError,
    }),
    addStage: useMutation({
      mutationFn: ({ pipelineId, input }: { pipelineId: string; input: StageInput }) =>
        createStage(pipelineId, input),
      onSuccess: onPipeline,
      onError,
    }),
    updateStage: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateStageInput }) =>
        updateStage(id, input),
      onSuccess: onPipeline,
      onError,
    }),
    removeStage: useMutation({
      mutationFn: (id: string) => deleteStage(id),
      onSuccess: onPipeline,
      onError,
    }),
  };
}

// --- Agenda ---

export function useTasks(params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: crmKeys.tasksList(params),
    queryFn: () => listTasks(params),
    enabled,
    retry: false,
  });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: crmKeys.tasks });
  const onError = (err: unknown) => toast.error(crmError(err).message);
  return {
    create: useMutation({
      mutationFn: (input: CreateTaskInput) => createTask(input),
      onSuccess: refresh,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
        updateTask(id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteTask(id),
      onSuccess: refresh,
      onError,
    }),
  };
}
