import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { updateSunatProfileTaxRegime } from "../services/sunat-profile.service";
import type { SunatTaxRegime } from "../utils/tax-regime";

export interface UpdateTaxRegimeInput {
  id: string;
  taxRegime: SunatTaxRegime;
}

/** Saves the issuer's tax regime (GENERAL or NUEVO_RUS). */
export function useUpdateSunatProfileTaxRegime(): UseMutationResult<
  SunatProfile,
  Error,
  UpdateTaxRegimeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSunatProfileTaxRegime,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      toast.success("Régimen tributario actualizado.");
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
