import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { RegisteredReferral } from "../models/registered-referral";
import { type RegisterReferralInput, registerReferral } from "../services/register-referral";

export function useRegisterReferral() {
  const queryClient = useQueryClient();

  return useMutation<RegisteredReferral, Error, RegisterReferralInput>({
    mutationFn: registerReferral,

    onSuccess: (_referral, { values }) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.referrals() });
      toast.success(`Registramos a ${values.businessName}. Queda en revisión antes de invitarlo.`);
    },

    onError: () => {
      toast.error("No pudimos registrar el referido. Intenta de nuevo.");
    },
  });
}
