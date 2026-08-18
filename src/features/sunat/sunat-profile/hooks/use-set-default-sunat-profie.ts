import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

      toast.success("Certificado SUNAT predeterminado actualizado correctamente.");
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
