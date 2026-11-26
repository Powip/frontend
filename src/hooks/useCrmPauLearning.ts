"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  approvePauLearning,
  discardPauLearning,
  getPauLearning,
  removePauDocument,
  uploadPauDocument,
} from "@/services/crmPauLearningService";

export const pauLearningKey = ["crm", "pau", "learning"] as const;

const onError = (err: unknown) => toast.error(crmError(err).message);

/** Mientras un documento se lee, la lista se refresca sola cada 4 s. */
export function usePauLearning(enabled = true) {
  return useQuery({
    queryKey: pauLearningKey,
    queryFn: getPauLearning,
    enabled,
    retry: false,
    refetchInterval: (q) => (q.state.data?.documents.some((d) => d.status === "processing") ? 4_000 : false),
  });
}

function useLearningMutation<T>(fn: (arg: T) => Promise<unknown>, ok: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pauLearningKey });
      toast.success(ok);
    },
    onError,
  });
}

export const useUploadPauDocument = () => useLearningMutation(uploadPauDocument, "Subido · Pau te propondrá respuestas");
export const useApprovePauLearning = () => useLearningMutation(approvePauLearning, "Aprobado · Pau ya lo usa");
export const useDiscardPauLearning = () => useLearningMutation(discardPauLearning, "Descartado");
export const useRemovePauDocument = () => useLearningMutation(removePauDocument, "Documento quitado");
