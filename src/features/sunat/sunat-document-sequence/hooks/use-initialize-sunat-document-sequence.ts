import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { InitializeSunatDocumentSequenceRequestDto } from "../dto/initialize-sunat-document-sequence-request.dto";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";
import { initializeSunatDocumentSequence } from "../services/sunat-document-sequence.service";
import { getSunatDocumentSequenceErrorMessage } from "../utils/sunat-document-sequence-error.util";

export function useInitializeSunatDocumentSequence() {
  const queryClient = useQueryClient();

  return useMutation<SunatDocumentSequence, Error, InitializeSunatDocumentSequenceRequestDto>({
    mutationFn: initializeSunatDocumentSequence,

    onSuccess: (sequence) => {
      queryClient.setQueryData(
        sunatDocumentSequenceKeys.detail(sequence.taxDocumentType, sequence.series),
        sequence,
      );

      // SeriesTab (and any other list consumer) reads from `lists()`, not
      // from the single-sequence `detail()` cache - without this it kept
      // showing stale data (or "No configurado") after a successful
      // initialize/edit until a full page reload.
      queryClient.invalidateQueries({
        queryKey: sunatDocumentSequenceKeys.lists(),
      });

      toast.success("Serie y correlativo inicializados correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getSunatDocumentSequenceErrorMessage(error));
    },
  });
}
