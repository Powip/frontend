import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  return useMutation<ApprovedApplication, Error, ApplicationDecisionInput>({
    mutationFn: approveAdminApplication,
    retry: false,

    onSuccess: (approved) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll() });
      toast.success(`Solicitud aprobada · código ${approved.code}`);
    },

    onError: (error) => {
      if (shouldRefreshQueue(error)) {
        queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll() });
      }
    },
  });
}

export function useRejectAdminApplication() {
  const queryClient = useQueryClient();

  return useMutation<RejectedApplication, Error, ApplicationDecisionInput>({
    mutationFn: rejectAdminApplication,
    retry: false,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll() });
      toast.success("Solicitud rechazada");
    },

    onError: (error) => {
      if (shouldRefreshQueue(error)) {
        queryClient.invalidateQueries({ queryKey: partnersKeys.adminApplicationsAll() });
      }
    },
  });
}
