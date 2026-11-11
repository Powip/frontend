import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReplaceSunatProfileCertificateInput } from "../dto/replace-sunat-profile-certificate-request.dto";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { replaceSunatProfileCertificate } from "../services/sunat-profile.service";
import { getSunatProfileErrorMessage } from "../utils/sunat-profile-error.util";

/**
 * Swaps the digital certificate of an existing profile. RUC, SOL credentials,
 * the default flag and the series stay as they were (backend contract).
 */
export function useReplaceSunatProfileCertificate(): UseMutationResult<
  SunatProfile,
  Error,
  ReplaceSunatProfileCertificateInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceSunatProfileCertificate,

    onSuccess: (profile) => {
      queryClient.setQueryData(sunatProfileKeys.detail(profile.id), profile);

      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      toast.success("Certificado reemplazado correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getSunatProfileErrorMessage(error));
    },
  });
}
