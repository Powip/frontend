import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateSunatProfileRequestDto } from "../dto/create-sunat-profile-request.dto";
import { sunatProfileKeys } from "../keys/sunat-profile.keys";
import type { SunatProfile } from "../models/sunat-profile";
import { createSunatProfile } from "../services/sunat-profile.service";

export function useCreateSunatProfile() {
  const queryClient = useQueryClient();

  return useMutation<SunatProfile, Error, CreateSunatProfileRequestDto>({
    mutationFn: createSunatProfile,

    onSuccess: (profile) => {
      queryClient.setQueryData(sunatProfileKeys.detail(profile.id), profile);

      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });
    },
  });
}
