import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import { deleteSunatProfile } from "../services/sunat-profile.service";
import { getSunatProfileErrorMessage } from "../utils/sunat-profile-error.util";

/**
 * Deletes a SUNAT profile (soft delete on the backend). Comprobantes already
 * issued are not affected; the RUC can be registered again afterwards.
 */
export function useDeleteSunatProfile(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSunatProfile,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      queryClient.removeQueries({
        queryKey: sunatProfileKeys.detail(id),
      });

      toast.success("Certificado eliminado correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getSunatProfileErrorMessage(error));
    },
  });
}
