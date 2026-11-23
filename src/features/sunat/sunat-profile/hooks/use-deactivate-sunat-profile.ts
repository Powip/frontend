import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatDocumentSequenceKeys } from "../../sunat-document-sequence/keys/sunat-document-sequence.keys";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { deactivateSunatProfile } from "../services/sunat-profile.service";
import { getSunatProfileErrorMessage } from "../utils/sunat-profile-error.util";

export function useDeactivateSunatProfile(): UseMutationResult<SunatProfile, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivateSunatProfile,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sunatProfileKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sunatDocumentSequenceKeys.lists() });
      toast.success("RUC desactivado. Conserva su certificado y puedes activarlo cuando quieras.");
    },

    onError: (error: Error) => {
      toast.error(getSunatProfileErrorMessage(error));
    },
  });
}
