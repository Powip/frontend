import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { InitializeSunatDocumentSequenceRequestDto } from "../dto/initialize-sunat-document-sequence-request.dto";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";
import { initializeSunatDocumentSequence } from "../services/sunat-document-sequence.service";

export function useInitializeSunatDocumentSequence() {
  const queryClient = useQueryClient();

  return useMutation<SunatDocumentSequence, Error, InitializeSunatDocumentSequenceRequestDto>({
    mutationFn: initializeSunatDocumentSequence,

    onSuccess: (sequence) => {
      queryClient.setQueryData(
        sunatDocumentSequenceKeys.detail(sequence.taxDocumentType, sequence.series),
        sequence,
      );

      toast.success("Serie y correlativo inicializados correctamente.");
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
