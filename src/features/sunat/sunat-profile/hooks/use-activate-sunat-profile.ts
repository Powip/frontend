import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatDocumentSequenceKeys } from "../../sunat-document-sequence/keys/sunat-document-sequence.keys";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { activateSunatProfile } from "../services/sunat-profile.service";
import { getSunatProfileErrorMessage } from "../utils/sunat-profile-error.util";

interface UseActivateSunatProfileOptions {
  /** Cuando no hay cupo libre (402) el servidor lo avisa: la pantalla decide si ofrece pagar un cupo. */
  onError?: (error: Error) => void;
}

export function useActivateSunatProfile(
  options: UseActivateSunatProfileOptions = {},
): UseMutationResult<SunatProfile, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateSunatProfile,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sunatProfileKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sunatDocumentSequenceKeys.lists() });
      toast.success("RUC activado.");
    },

    onError: (error: Error) => {
      if (options.onError) {
        options.onError(error);
        return;
      }

      toast.error(getSunatProfileErrorMessage(error));
    },
  });
}
