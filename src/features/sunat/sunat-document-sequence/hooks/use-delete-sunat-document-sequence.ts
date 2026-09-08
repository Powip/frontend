import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DeleteSunatDocumentSequenceQuery } from "../dto/delete-sunat-document-sequence.query";
import { sunatDocumentSequenceKeys } from "../keys/sunat-document-sequence.keys";
import { deleteSunatDocumentSequence } from "../services/sunat-document-sequence.service";
import { getSunatDocumentSequenceErrorMessage } from "../utils/sunat-document-sequence-error.util";

/**
 * Permanently deletes a sequence's numbering counter. This does NOT delete
 * SUNAT documents already issued under that series - only the counter
 * itself (mirrors the backend's own doc comment on the DELETE endpoint).
 * The series can be re-created later via the initialize modal.
 */
export function useDeleteSunatDocumentSequence(): UseMutationResult<
  void,
  Error,
  DeleteSunatDocumentSequenceQuery
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSunatDocumentSequence,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sunatDocumentSequenceKeys.lists(),
      });

      queryClient.removeQueries({
        queryKey: sunatDocumentSequenceKeys.detail(variables.taxDocumentType, variables.series),
      });

      toast.success("Serie eliminada correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getSunatDocumentSequenceErrorMessage(error));
    },
  });
}
