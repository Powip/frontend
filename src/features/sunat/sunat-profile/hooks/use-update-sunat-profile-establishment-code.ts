import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { updateSunatProfileEstablishmentCode } from "../services/sunat-profile.service";

export interface UpdateEstablishmentCodeInput {
  id: string;
  establishmentCode: string;
}

/** Saves the issuer's SUNAT establishment code ("código de local anexo"). */
export function useUpdateSunatProfileEstablishmentCode(): UseMutationResult<
  SunatProfile,
  Error,
  UpdateEstablishmentCodeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSunatProfileEstablishmentCode,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      toast.success("Código de establecimiento actualizado.");
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
