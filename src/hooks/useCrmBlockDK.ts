"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  getCatalogAttribution,
  getCatalogSettings,
  listTestimonies,
  proposeTestimony,
  reviewMaterial,
  saveAttributionDays,
  saveCatalogSettings,
} from "@/services/crmBlockDKService";
import type { MaterialStatus, Testimony } from "@/types/crmBlockDK";

export const blockDKKeys = {
  testimonies: (status: MaterialStatus | "") => ["crm", "content", "testimonies", status] as const,
  catalogSettings: ["crm", "content", "catalog-settings"] as const,
  attribution: ["crm", "content", "catalog-attribution"] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

export function useTestimonies(status: MaterialStatus | "" = "pending", enabled = true) {
  return useQuery({
    queryKey: blockDKKeys.testimonies(status),
    queryFn: () => listTestimonies(status || undefined),
    enabled,
    retry: false,
  });
}

export function useTestimonyActions() {
  const qc = useQueryClient();
  // Refresca testimonios, fichas y material: lo aprobado aparece en «Material de venta».
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "content"] });
  const review = useMutation({
    mutationFn: ({ item, status }: { item: Testimony; status: "published" | "rejected" }) => reviewMaterial(item.id, status),
    onSuccess: (_r, { item, status }) => {
      toast.success(
        status === "published"
          ? `Aprobado · ya está en Testimonios de ${item.sheetName ?? "su producto"}`
          : "Rechazado · no se publica",
      );
      refresh();
    },
    onError,
  });
  const propose = useMutation({
    mutationFn: (input: { sheetId: string; title: string; url: string }) => proposeTestimony(input),
    onSuccess: (t) => {
      toast.success(
        t.status === "published"
          ? "Testimonio publicado"
          : "Enviado al supervisor para aprobar",
      );
      refresh();
    },
    onError,
  });
  return { review, propose };
}

export function useCatalogSettings(enabled = true) {
  return useQuery({ queryKey: blockDKKeys.catalogSettings, queryFn: getCatalogSettings, enabled, retry: false });
}

export function useCatalogAttribution(enabled = true) {
  return useQuery({ queryKey: blockDKKeys.attribution, queryFn: getCatalogAttribution, enabled, retry: false });
}

export function useCatalogSettingsActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: blockDKKeys.catalogSettings });
    qc.invalidateQueries({ queryKey: blockDKKeys.attribution });
  };
  const soldOut = useMutation({
    mutationFn: (showSoldOut: boolean) => saveCatalogSettings({ showSoldOut }),
    onSuccess: (s) => {
      qc.setQueryData(blockDKKeys.catalogSettings, s);
      toast.success(s.showSoldOut ? "El catálogo muestra productos agotados" : "El catálogo oculta variantes sin stock");
    },
    onError,
  });
  const days = useMutation({
    mutationFn: (d: number) => saveAttributionDays(d),
    onSuccess: (_r, d) => {
      toast.success(`Atribución guardada · ${d} ${d === 1 ? "día" : "días"}`);
      refresh();
      qc.invalidateQueries({ queryKey: ["crm", "settings"] });
    },
    onError,
  });
  return { soldOut, days };
}
