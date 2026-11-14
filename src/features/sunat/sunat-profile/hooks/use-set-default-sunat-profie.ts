import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatDocumentSequenceKeys } from "../../sunat-document-sequence/keys/sunat-document-sequence.keys";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { setDefaultSunatProfile } from "../services/sunat-profile.service";

export function useSetDefaultSunatProfile(): UseMutationResult<SunatProfile, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultSunatProfile,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      // Sequence queries without an explicit profile resolve to the default
      // RUC on the backend, so they change when the default does.
      queryClient.invalidateQueries({
        queryKey: sunatDocumentSequenceKeys.lists(),
      });

      toast.success("Certificado SUNAT predeterminado actualizado correctamente.");
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
