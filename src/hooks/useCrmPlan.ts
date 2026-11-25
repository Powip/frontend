"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import { useAuth } from "@/contexts/AuthContext";
import { crmError } from "@/services/crmService";
import {
  disconnectChannelAccount,
  getCrmAccess,
  getCrmPlan,
  listChannelAccounts,
  reconnectChannelAccount,
  updateChannelAccount,
  type ChannelAccount,
  type UpdateChannelAccountInput,
} from "@/services/crmPlanService";

export const planKeys = {
  plan: ["crm", "plan"] as const,
  access: ["crm", "access"] as const,
  channels: ["crm", "channels"] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

export function useCrmPlan() {
  return useQuery({ queryKey: planKeys.plan, queryFn: getCrmPlan, retry: false });
}

/**
 * Acceso al CRM (correo permitido y pago confirmado). Si la consulta falla, quien la usa
 * trata el CRM como cerrado: el menú y la ruta no se muestran sin una respuesta «allowed».
 */
export function useCrmAccess(enabled = true) {
  const { auth } = useAuth();
  return useQuery({
    // Por usuario y empresa: al cambiar de cuenta no se reusa el acceso de otra.
    queryKey: [...planKeys.access, auth?.user?.id ?? null, auth?.company?.id ?? null],
    queryFn: getCrmAccess,
    enabled: enabled && !!auth?.accessToken,
    retry: false,
    staleTime: 60_000,
  });
}

export function useChannelAccounts() {
  return useQuery({ queryKey: planKeys.channels, queryFn: listChannelAccounts, retry: false });
}

const replaceAccount = (rows: ChannelAccount[] | undefined, next: ChannelAccount) =>
  rows?.map((r) => (r.id === next.id ? { ...r, ...next } : r));

export function useUpdateChannelAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChannelAccountInput }) =>
      updateChannelAccount(id, input),
    onSuccess: (data) => {
      qc.setQueryData<ChannelAccount[]>(planKeys.channels, (rows) => replaceAccount(rows, data));
      // Los chats de la cuenta siguen a la nueva tienda.
      qc.invalidateQueries({ queryKey: crmKeys.conversations });
      toast.success("Cuenta actualizada");
    },
    onError,
  });
}

export function useDisconnectChannelAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (account: ChannelAccount) => disconnectChannelAccount(account.id),
    onSuccess: (data, account) => {
      qc.setQueryData<ChannelAccount[]>(planKeys.channels, (rows) => replaceAccount(rows, data));
      toast.success(`${account.name || account.accountId} desconectada`);
    },
    onError,
  });
}

export function useReconnectChannelAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (account: ChannelAccount) => reconnectChannelAccount(account.id),
    onSuccess: (data, account) => {
      qc.setQueryData<ChannelAccount[]>(planKeys.channels, (rows) => replaceAccount(rows, data));
      toast.success(`${account.name || account.accountId} reconectada`);
    },
    onError,
  });
}
