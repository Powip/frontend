"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import { crmError } from "@/services/crmService";
import type { RuleObjective, RuleTarget } from "@/types/crm";

const BASE = `${API.crm}/crm/followup-rules`;

/** Envío que el motor de seguimientos hará hoy (GET followup-rules/upcoming). */
export interface UpcomingFollowup {
  ruleId: string;
  ruleName: string;
  objective: RuleObjective;
  target: RuleTarget;
  conversationId: string;
  contactName: string | null;
  channel: string;
  dueAt: string;
  viaTemplate: boolean;
  templateName: string | null;
}

const KEY = ["crm", "followups", "upcoming"] as const;

export function useUpcomingFollowups() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await axiosAuth.get<{ items: UpcomingFollowup[] }>(`${BASE}/upcoming`)).data.items,
    refetchInterval: 60_000,
  });
}

/** Solo administrador: el backend responde 403 a una vendedora. */
export function useUpcomingMutations() {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["crm", "followup-runs"] });
  };
  const onError = (err: unknown) => toast.error(crmError(err).message);
  const path = (u: Pick<UpcomingFollowup, "ruleId" | "conversationId">, action: string) =>
    `${BASE}/${u.ruleId}/conversations/${u.conversationId}/${action}`;
  return {
    sendNow: useMutation({
      mutationFn: async (u: UpcomingFollowup) =>
        (await axiosAuth.post<{ result: string; detail: string | null }>(path(u, "send-now"))).data,
      onSuccess: done,
      onError,
    }),
    cancel: useMutation({
      mutationFn: async (u: UpcomingFollowup) => (await axiosAuth.post(path(u, "cancel"))).data,
      onSuccess: done,
      onError,
    }),
  };
}
