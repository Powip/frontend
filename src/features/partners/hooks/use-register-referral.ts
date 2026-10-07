import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import { toPartnersRequestError } from "../mappers/to-partners-request-error";
import type { RegisteredReferral } from "../models/registered-referral";
import { type RegisterReferralInput, registerReferral } from "../services/register-referral";
import { getPartnersErrorMessage } from "../utils/partners-error-message";

export function useRegisterReferral() {
  const queryClient = useQueryClient();

  return useMutation<RegisteredReferral, Error, RegisterReferralInput>({
    mutationFn: registerReferral,
    retry: false,

    onSuccess: (_referral, { values }) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.referralsAll() });
      toast.success(`Registramos a ${values.businessName}. Queda en revisión antes de invitarlo.`);
    },

    onError: (error) => {
      toast.error(
        getPartnersErrorMessage(
          toPartnersRequestError(error),
          "No pudimos registrar el referido. Intenta de nuevo.",
        ),
      );
    },
  });
}
