"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  activatePauTraining,
  compilePauTraining,
  deactivatePauTraining,
  examPauTraining,
  getPauTrainings,
} from "@/services/crmTrainingService";

export const pauTrainingKey = ["crm", "pau", "trainings"] as const;

const onError = (err: unknown) => toast.error(crmError(err).message);

export function usePauTrainings(enabled = true) {
  return useQuery({ queryKey: pauTrainingKey, queryFn: getPauTrainings, enabled, retry: false });
}

function useTrainingMutation<T>(fn: (arg: T) => Promise<unknown>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pauTrainingKey });
      toast.success(ok);
    },
    onError,
  });
}

export const useCompilePauTraining = () => useTrainingMutation(() => compilePauTraining(), "Versión compilada");
export const useExamPauTraining = () => useTrainingMutation((id: string) => examPauTraining(id), "Examen terminado");
export const useActivatePauTraining = () =>
  useTrainingMutation((id: string) => activatePauTraining(id), "Entrenamiento activado");
export const useDeactivatePauTraining = () =>
  useTrainingMutation(() => deactivatePauTraining(), "Pau vuelve a la metodología base");
