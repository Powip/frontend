import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { PayoutSettings } from "../models/payout-settings";
import type { UpdatePayoutSettingsFormValues } from "../schemas/update-payout-settings.schema";
import { updatePayoutSettings } from "../services/update-payout-settings";
import { partnersMutationErrorMessage } from "../utils/unavailable-partners-feature";

export function useUpdatePayoutSettings() {
  const queryClient = useQueryClient();

  return useMutation<PayoutSettings, Error, UpdatePayoutSettingsFormValues>({
    mutationFn: updatePayoutSettings,

    onSuccess: (settings) => {
      queryClient.setQueryData(partnersKeys.payoutSettings(), settings);
      toast.success("Datos de cobro actualizados.");
    },

    onError: (error) => {
      toast.error(
        partnersMutationErrorMessage(
          error,
          "No pudimos actualizar tus datos de cobro. Intenta de nuevo.",
        ),
      );
    },
  });
}
