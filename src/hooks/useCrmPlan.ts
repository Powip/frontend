"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import { crmError } from "@/services/crmService";
import {
  disconnectChannelAccount,
  getCrmPlan,
  listChannelAccounts,
  reconnectChannelAccount,
  updateChannelAccount,
  updateCrmPlan,
  type ChannelAccount,
  type UpdateChannelAccountInput,
  type UpdateCrmPlanInput,
} from "@/services/crmPlanService";

export const planKeys = {
  plan: ["crm", "plan"] as const,
  channels: ["crm", "channels"] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

export function useCrmPlan() {
  return useQuery({ queryKey: planKeys.plan, queryFn: getCrmPlan, retry: false });
}

export function useUpdateCrmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCrmPlanInput) => updateCrmPlan(input),
    onSuccess: (data, input) => {
      qc.setQueryData(planKeys.plan, data);
      // Quitar Pau apaga su modo en el servidor: refresca la pantalla de Pau.
      qc.invalidateQueries({ queryKey: crmKeys.pauSettings });
      if (input.pauOn !== undefined) {
        toast.success(
          data.pauOn
            ? `Plan CRM + Pau · S/ ${data.prices.bundle}`
            : "Plan solo CRM · Pau queda en «Solo CRM»",
        );
      } else if (input.accountType !== undefined) {
        toast.success(
          data.accountType === "solo"
            ? `Cuenta Solo POWIP CRM · ${data.domain}`
            : `Cuenta POWIP Core + CRM · ${data.domain}`,
        );
      }
    },
    onError,
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
