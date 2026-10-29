"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  ReconciliationTaskDetails,
  getReconciliationTaskDetails,
} from "@/services/reconciliationTask.service";

/**
 * FEAT-17 Anexo B — detalle enriquecido (producto, marca, categoría,
 * variantes hermanas) de las candidatas de un cluster de duplicados, para
 * `ReconciliationMergeDialog`. `retry: false` porque un 404 (tarea de otra
 * empresa) o cualquier otro error deben caer directo al fallback de
 * `task.items` en vez de reintentar en silencio.
 */
export function useReconciliationTaskDetails(taskId: string | null) {
  const { auth } = useAuth();
  return useQuery<ReconciliationTaskDetails, Error>({
    queryKey: ["reconciliation-task-details", auth?.company?.id, auth?.user?.id, taskId],
    queryFn: () => getReconciliationTaskDetails(taskId as string),
    enabled: taskId !== null && Boolean(auth?.company?.id && auth?.user?.id && auth?.accessToken),
    staleTime: 30 * 1000,
    retry: false,
  });
}
