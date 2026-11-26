"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  exportAudience,
  getAdResults,
  getConversationAdSignal,
  getMetaAdsSettings,
  listAudienceExports,
  listAudienceSegments,
  listCapiEvents,
  listMetaAdAccounts,
  updateMetaAdsSettings,
  type ExportAudienceInput,
  type MetaAdsSettingsInput,
} from "@/services/crmMetaAdsService";

export const metaAdsKeys = {
  settings: ["crm", "meta-ads", "settings"] as const,
  accounts: ["crm", "meta-ads", "ad-accounts"] as const,
  segments: (storeId: string) => ["crm", "meta-ads", "segments", storeId] as const,
  allSegments: ["crm", "meta-ads", "segments"] as const,
  audiences: ["crm", "meta-ads", "audiences"] as const,
  capi: ["crm", "meta-ads", "capi-events"] as const,
  signal: (id: string) => ["crm", "meta-ads", "signal", id] as const,
  results: (from: string, to: string, account: string) => ["crm", "meta-ads", "results", from, to, account] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

export function useMetaAdsSettings() {
  return useQuery({ queryKey: metaAdsKeys.settings, queryFn: getMetaAdsSettings, retry: false });
}

export function useUpdateMetaAdsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MetaAdsSettingsInput) => updateMetaAdsSettings(input),
    onSuccess: (data) => {
      qc.setQueryData(metaAdsKeys.settings, data);
      toast.success("Ajustes de Meta guardados");
    },
    onError,
  });
}

export function useMetaAdAccounts(enabled = true) {
  return useQuery({ queryKey: metaAdsKeys.accounts, queryFn: listMetaAdAccounts, retry: false, enabled });
}

export function useAudienceSegments(storeId: string) {
  return useQuery({
    queryKey: metaAdsKeys.segments(storeId),
    queryFn: () => listAudienceSegments(storeId || undefined),
    retry: false,
  });
}

export function useAudienceExports() {
  return useQuery({ queryKey: metaAdsKeys.audiences, queryFn: listAudienceExports, retry: false });
}

export function useCapiEvents() {
  return useQuery({ queryKey: metaAdsKeys.capi, queryFn: listCapiEvents, retry: false });
}

export function useExportAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExportAudienceInput) => exportAudience(input),
    onSuccess: (res) => {
      toast.success(`Público enviado a Meta: ${res.contactCount} contactos`);
      qc.invalidateQueries({ queryKey: metaAdsKeys.audiences });
      qc.invalidateQueries({ queryKey: metaAdsKeys.allSegments });
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: metaAdsKeys.audiences });
      onError(err);
    },
  });
}

export function useConversationAdSignal(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: metaAdsKeys.signal(conversationId ?? ""),
    queryFn: () => getConversationAdSignal(conversationId!),
    enabled: !!conversationId,
    retry: false,
    staleTime: 60_000,
  });
}

export function useAdResults(from: string, to: string, adAccountId: string | undefined) {
  return useQuery({
    queryKey: metaAdsKeys.results(from, to, adAccountId ?? ""),
    queryFn: () => getAdResults({ from, to, ...(adAccountId ? { adAccountId } : {}) }),
    enabled: !!from && !!to && from <= to,
    retry: false,
    staleTime: 60_000,
  });
}
