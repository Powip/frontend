import { useMutation, UseMutationResult, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatProfileKeys } from "@/api/sunat/keys/sunat-profile.keys";
import * as service from "@/services/sunat/sunat-profile.service";
import { SunatProfile } from "@/models/sunat/sunat-profile";
import { CreateSunatProfileInput } from "@/schemas/sunat/create-sunat-profile.schema";

export function useCreateSunatProfile(): UseMutationResult<
  SunatProfile,
  Error,
  CreateSunatProfileInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: service.createSunatProfile,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      toast.success("Perfil SUNAT creado correctamente.");
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
