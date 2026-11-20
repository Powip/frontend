"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listLabelFormats } from "@/services/labelsService";

export const labelFormatsKey = (companyId: string) => ["label-formats", companyId] as const;

/** FEAT-24 H7 — formatos de etiqueta de la empresa activa (predeterminado primero). */
export function useLabelFormats() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  return useQuery({
    queryKey: labelFormatsKey(companyId),
    queryFn: listLabelFormats,
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 60_000,
  });
}
