import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import { toPartnersRequestError } from "../mappers/to-partners-request-error";
import type { ApprovedApplication, RejectedApplication } from "../models/application-decision";
import {
  type ApplicationDecisionInput,
  approveAdminApplication,
  rejectAdminApplication,
} from "../services/decide-admin-application";

function shouldRefreshQueue(error: Error): boolean {
  const { kind, code } = toPartnersRequestError(error);
  return kind === "conflict" && code === "APPLICATION_STATE_CONFLICT";
}

export function useApproveAdminApplication() {
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;

  return useMutation<ApprovedApplication, Error, ApplicationDecisionInput>({
    mutationKey: [...partnersKeys.user(userId), "approve-application"],
    mutationFn: (input) => {
      if (!userId || !accessToken || tokenStore.get() !== accessToken) {
        return Promise.reject(new Error("La sesión de Partners cambió. Volvé a intentarlo."));
      }
      return approveAdminApplication(input, accessToken);
    },
    retry: false,

    onSuccess: (approved) => {
      if (tokenStore.get() !== accessToken) return;
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll(userId) });
      toast.success(`Solicitud aprobada · código ${approved.code}`);
    },

    onError: (error) => {
      if (tokenStore.get() !== accessToken) return;
      if (shouldRefreshQueue(error)) {
        queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll(userId) });
      }
    },
  });
}

export function useRejectAdminApplication() {
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;

  return useMutation<RejectedApplication, Error, ApplicationDecisionInput>({
    mutationKey: [...partnersKeys.user(userId), "reject-application"],
    mutationFn: (input) => {
      if (!userId || !accessToken || tokenStore.get() !== accessToken) {
        return Promise.reject(new Error("La sesión de Partners cambió. Volvé a intentarlo."));
      }
      return rejectAdminApplication(input, accessToken);
    },
    retry: false,

    onSuccess: () => {
      if (tokenStore.get() !== accessToken) return;
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll(userId) });
      toast.success("Solicitud rechazada");
    },

    onError: (error) => {
      if (tokenStore.get() !== accessToken) return;
      if (shouldRefreshQueue(error)) {
        queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll(userId) });
      }
    },
  });
}
