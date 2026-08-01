import {
  useMutation,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { sunatProfileKeys } from "@/api/sunat/keys/sunat-profile.keys";
import * as service from "@/services/sunat/sunat-profile.service";
import { SunatProfile } from "@/models/sunat/sunat-profile";

export function useSetDefaultSunatProfile(): UseMutationResult<
  SunatProfile,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: service.setDefaultSunatProfile,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sunatProfileKeys.lists(),
      });

      toast.success(
        "Certificado SUNAT predeterminado actualizado correctamente."
      );
    },

    onError(error: Error) {
      toast.error(error.message);
    },
  });
}
