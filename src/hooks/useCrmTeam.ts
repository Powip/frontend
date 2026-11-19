"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  getAudit,
  getCrmSettings,
  getTeamStats,
  listTeamMembers,
  reassignConversation,
  remindScript,
  updateCrmSettings,
} from "@/services/crmTeamService";
import type { CrmSettings, CrmSettingsInput, TeamDays, TeamPerson } from "@/types/crmTeam";

export const teamKeys = {
  stats: (days: number) => ["crm", "team", "stats", days] as const,
  allStats: ["crm", "team", "stats"] as const,
  members: ["crm", "team", "members"] as const,
  audit: ["crm", "audit"] as const,
  settings: ["crm", "settings"] as const,
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

export function useCrmSettings() {
  return useQuery({ queryKey: teamKeys.settings, queryFn: getCrmSettings, retry: false });
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
