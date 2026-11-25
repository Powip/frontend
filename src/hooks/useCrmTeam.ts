"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  getAudit,
  getCrmSettings,
  connectMetaAccount,
  createExport,
  getExportLog,
  setDailyGoal,
  connectTikTokOAuth,
  deleteMetaAccount,
  deleteTikTokAccount,
  getTeamDay,
  getTeamStats,
  listMetaAccounts,
  listTikTokAccounts,
  listTeamMembers,
  reassignConversation,
  remindScript,
  updateCrmSettings,
} from "@/services/crmTeamService";
import type {
  ConnectMetaAccountInput,
  CreateExportInput,
  CrmSettings,
  CrmSettingsInput,
  TeamDays,
  TeamPerson,
} from "@/types/crmTeam";

export const teamKeys = {
  stats: (days: number) => ["crm", "team", "stats", days] as const,
  day: (who: string) => ["crm", "team", "day", who] as const,
  allStats: ["crm", "team", "stats"] as const,
  members: ["crm", "team", "members"] as const,
  audit: ["crm", "audit"] as const,
  settings: ["crm", "settings"] as const,
  metaAccounts: ["crm", "meta-accounts"] as const,
  tiktokAccounts: ["crm", "tiktok-accounts"] as const,
  exportLog: ["crm", "export", "log"] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

/** Solo administrador: llamar únicamente si el usuario lo es. Se refresca cada 60 s. */
export function useTeamStats(days: TeamDays) {
  return useQuery({
    queryKey: teamKeys.stats(days),
    queryFn: () => getTeamStats(days),
    retry: false,
    refetchInterval: 60_000,
  });
}

/** Mi día: ventas de hoy de una vendedora, de Pau o de todo el equipo. Se refresca cada 60 s. */
export function useTeamDay(userId?: string) {
  return useQuery({
    queryKey: teamKeys.day(userId ?? "me"),
    queryFn: () => getTeamDay(userId),
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: teamKeys.members,
    queryFn: listTeamMembers,
    retry: false,
    staleTime: 60_000,
  });
}

export function useReassignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; person: TeamPerson }) => reassignConversation(v.id, v.person),
    onSuccess: (_c, v) => {
      qc.invalidateQueries({ queryKey: teamKeys.allStats });
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] });
      toast.success(`Chat reasignado a ${v.person.userName}`);
    },
    onError,
  });
}

export function useAudit() {
  return useQuery({ queryKey: teamKeys.audit, queryFn: getAudit, retry: false });
}

export function useRemindScript() {
  return useMutation({
    mutationFn: (person: TeamPerson) => remindScript(person),
    onSuccess: (_r, person) => toast.success(`Aviso creado en la Agenda de ${person.userName}`),
    onError,
  });
}

export function useCrmSettings(enabled = true) {
  return useQuery({ queryKey: teamKeys.settings, queryFn: getCrmSettings, retry: false, enabled });
}

export function useUpdateCrmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrmSettingsInput) => updateCrmSettings(input),
    onSuccess: (settings: CrmSettings) => {
      qc.setQueryData(teamKeys.settings, settings);
      qc.invalidateQueries({ queryKey: teamKeys.allStats });
      toast.success("Ajuste guardado");
    },
    onError,
  });
}

export function useMetaAccounts() {
  return useQuery({ queryKey: teamKeys.metaAccounts, queryFn: listMetaAccounts, retry: false });
}

/** Sin toast de error: la tarjeta muestra el mensaje junto al formulario. */
export function useConnectMetaAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectMetaAccountInput) => connectMetaAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.metaAccounts }),
  });
}

export function useDeleteMetaAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMetaAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.metaAccounts }),
  });
}

export function useTikTokAccounts() {
  return useQuery({ queryKey: teamKeys.tiktokAccounts, queryFn: listTikTokAccounts, retry: false });
}

/** Sin toast de error: la tarjeta muestra el mensaje. */
export function useConnectTikTokOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; state: string }) => connectTikTokOAuth(input.code, input.state),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.tiktokAccounts }),
  });
}

export function useDeleteTikTokAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTikTokAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.tiktokAccounts }),
  });
}

export function useSetDailyGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goal: number) => setDailyGoal(goal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.allStats });
      qc.invalidateQueries({ queryKey: teamKeys.settings });
      toast.success("Meta del día guardada");
    },
    onError,
  });
}

export function useExportLog() {
  return useQuery({ queryKey: teamKeys.exportLog, queryFn: getExportLog, retry: false });
}

/** Devuelve las hojas; quien llama arma el Excel. */
export function useCreateExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExportInput) => createExport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.exportLog }),
    onError,
  });
}
