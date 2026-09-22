import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerReferral } from "../models/partner-referral";
import { registerReferral } from "../services/register-referral";
import type { RegisterReferralFormValues } from "../schemas/register-referral.schema";

export function useRegisterReferral() {
  const queryClient = useQueryClient();

  return useMutation<PartnerReferral, Error, RegisterReferralFormValues>({
    mutationFn: registerReferral,

    onSuccess: (referral) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.referrals() });
      toast.success(`Invitación enviada a ${referral.businessName}.`);
    },

    onError: () => {
      toast.error("No pudimos registrar el referido. Intenta de nuevo.");
    },
  });
}
