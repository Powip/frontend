import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { olvaSenderProfileKeys } from "../keys/olva-sender-profile.keys";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import {
  type UpdateOlvaSenderProfileInput,
  updateOlvaSenderProfile,
} from "../services/olva-sender-profile.service";
import { getOlvaSenderProfileErrorMessage } from "../utils/olva-sender-profile-error.util";

export function useUpdateOlvaSenderProfile(): UseMutationResult<
  OlvaSenderProfile,
  Error,
  UpdateOlvaSenderProfileInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOlvaSenderProfile,

    onSuccess: (profile) => {
      queryClient.setQueryData(olvaSenderProfileKeys.detail(profile.id), profile);

      queryClient.invalidateQueries({
        queryKey: olvaSenderProfileKeys.lists(),
      });

      toast.success("Remitente actualizado correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getOlvaSenderProfileErrorMessage(error));
    },
  });
}
