import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateOlvaSenderProfileRequestDto } from "../dto/create-olva-sender-profile-request.dto";
import { olvaSenderProfileKeys } from "../keys/olva-sender-profile.keys";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import { createOlvaSenderProfile } from "../services/olva-sender-profile.service";
import { getOlvaSenderProfileErrorMessage } from "../utils/olva-sender-profile-error.util";

export function useCreateOlvaSenderProfile(): UseMutationResult<
  OlvaSenderProfile,
  Error,
  CreateOlvaSenderProfileRequestDto
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOlvaSenderProfile,

    onSuccess: (profile) => {
      queryClient.setQueryData(olvaSenderProfileKeys.detail(profile.id), profile);

      // Creating with isDefault may move the default flag of another profile
      queryClient.invalidateQueries({
        queryKey: olvaSenderProfileKeys.lists(),
      });

      toast.success("Remitente creado correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getOlvaSenderProfileErrorMessage(error));
    },
  });
}
