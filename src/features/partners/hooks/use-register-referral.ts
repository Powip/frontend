import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import { toPartnersRequestError } from "../mappers/to-partners-request-error";
import type { RegisteredReferral } from "../models/registered-referral";
import { type RegisterReferralInput, registerReferral } from "../services/register-referral";
import { getPartnersErrorMessage } from "../utils/partners-error-message";

export function useRegisterReferral() {
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;

  return useMutation<RegisteredReferral, Error, RegisterReferralInput>({
    mutationKey: [...partnersKeys.user(userId), "register-referral"],
    mutationFn: (input) => {
      if (!userId || !accessToken || tokenStore.get() !== accessToken) {
        return Promise.reject(new Error("La sesión de Partners cambió. Volvé a intentarlo."));
      }
      return registerReferral(input, accessToken);
    },
    retry: false,

    onSuccess: (_referral, { values }) => {
      if (tokenStore.get() !== accessToken) return;
      queryClient.invalidateQueries({ queryKey: partnersKeys.referralsAll(userId) });
      toast.success(`Registramos a ${values.businessName}. Queda en revisión antes de invitarlo.`);
    },

    onError: (error) => {
      if (tokenStore.get() !== accessToken) return;
      toast.error(
        getPartnersErrorMessage(
          toPartnersRequestError(error),
          "No pudimos registrar el referido. Intenta de nuevo.",
        ),
      );
    },
  });
}
