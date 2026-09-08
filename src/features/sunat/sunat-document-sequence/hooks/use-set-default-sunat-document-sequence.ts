import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SetDefaultSunatDocumentSequenceRequestDto } from "../dto/set-default-sunat-document-sequence-request.dto";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";
import { setDefaultSunatDocumentSequence } from "../services/sunat-document-sequence.service";
import { getSunatDocumentSequenceErrorMessage } from "../utils/sunat-document-sequence-error.util";

export function useSetDefaultSunatDocumentSequence(): UseMutationResult<
  SunatDocumentSequence,
  Error,
  SetDefaultSunatDocumentSequenceRequestDto
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultSunatDocumentSequence,

    onSuccess: (sequence) => {
      queryClient.setQueryData(
        sunatDocumentSequenceKeys.detail(sequence.taxDocumentType, sequence.series),
        sequence,
      );

      // The backend flips `isDefault` on the previous default series too
      // (atomically), and we have no cache entry addressed by "whichever
      // series used to be default for this doc type" - a targeted update
      // isn't possible, so refetch the list instead of trying to patch
      // both rows by hand.
      queryClient.invalidateQueries({
        queryKey: sunatDocumentSequenceKeys.lists(),
      });

      toast.success(`Serie ${sequence.series} marcada como predeterminada.`);
    },

    onError: (error: Error) => {
      toast.error(getSunatDocumentSequenceErrorMessage(error));
    },
  });
}
