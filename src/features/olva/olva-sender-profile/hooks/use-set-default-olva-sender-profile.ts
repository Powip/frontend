import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { olvaSenderProfileKeys } from "../keys/olva-sender-profile.keys";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import { setDefaultOlvaSenderProfile } from "../services/olva-sender-profile.service";
import { getOlvaSenderProfileErrorMessage } from "../utils/olva-sender-profile-error.util";

export function useSetDefaultOlvaSenderProfile(): UseMutationResult<
  OlvaSenderProfile,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultOlvaSenderProfile,

    onSuccess: (profile) => {
      queryClient.setQueryData(olvaSenderProfileKeys.detail(profile.id), profile);

      // The previous default loses its flag, so every cached profile may have changed
      queryClient.invalidateQueries({
        queryKey: olvaSenderProfileKeys.all,
      });

      toast.success("Remitente predeterminado actualizado correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getOlvaSenderProfileErrorMessage(error));
    },
  });
}
