import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminPartner } from "../models/admin-partner";
import { approveAdminPartner } from "../services/approve-admin-partner";

export function useApproveAdminPartner() {
  const queryClient = useQueryClient();

  return useMutation<AdminPartner, Error, string>({
    mutationFn: approveAdminPartner,

    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminPartners() });
      queryClient.setQueryData(partnersKeys.adminPartner(partner.id), partner);
      toast.success(`${partner.name} aprobado · código ${partner.code}`);
    },

    onError: () => {
      toast.error("No pudimos aprobar al partner. Intenta de nuevo.");
    },
  });
}
