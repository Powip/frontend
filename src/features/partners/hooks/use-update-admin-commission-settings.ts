import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { AdminCommissionSettings } from "../models/admin-commission-settings";
import { updateAdminCommissionSettings } from "../services/update-admin-commission-settings";

interface UpdateOptions {
  successMessage?: string;
}

export function useUpdateAdminCommissionSettings() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminCommissionSettings,
    Error,
    { update: Partial<AdminCommissionSettings> } & UpdateOptions
  >({
    mutationFn: ({ update }) => updateAdminCommissionSettings(update),

    onSuccess: (settings, variables) => {
      queryClient.setQueryData(partnersKeys.adminCommissionSettings(), settings);
      toast.success(variables.successMessage ?? "Configuración guardada");
    },

    onError: () => {
      toast.error("No pudimos guardar los cambios. Intenta de nuevo.");
    },
  });
}
