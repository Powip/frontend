import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelExtraRucApi } from "../api/extra-ruc.api";
import { extraRucKeys } from "../keys/extra-ruc.keys";
import type { ExtraRucPurchase } from "../models/extra-ruc";
import { getExtraRucErrorMessage } from "../utils/extra-ruc-error.util";

/** Da de baja un RUC extra (no se renueva; vale hasta el final del período pagado). */
export function useCancelExtraRuc(): UseMutationResult<ExtraRucPurchase, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelExtraRucApi,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extraRucKeys.all });
      toast.success("RUC extra dado de baja. Seguirá activo hasta el final del período pagado.");
    },

    onError: (error: Error) => {
      toast.error(getExtraRucErrorMessage(error));
    },
  });
}
