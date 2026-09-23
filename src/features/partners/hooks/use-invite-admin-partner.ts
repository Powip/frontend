import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminPartner } from "../models/admin-partner";
import type { InviteAdminPartnerFormValues } from "../schemas/invite-admin-partner.schema";
import { inviteAdminPartner } from "../services/invite-admin-partner";

export function useInviteAdminPartner() {
  const queryClient = useQueryClient();

  return useMutation<AdminPartner, Error, InviteAdminPartnerFormValues>({
    mutationFn: inviteAdminPartner,

    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.adminPartners() });
      toast.success(`Invitación enviada a ${partner.name}`);
    },

    onError: () => {
      toast.error("No pudimos enviar la invitación. Intenta de nuevo.");
    },
  });
}
