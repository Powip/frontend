"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getCpeValidationAccessApi, getCpeValidationCredentialApi } from "./cpe-validation.api";

// Las claves llevan la empresa y el usuario: el permiso sale del correo del usuario.

export const cpeValidationKeys = {
  all: ["cpe-validation"] as const,
  access: (companyId: string, userId: string) => [...cpeValidationKeys.all, "access", companyId, userId] as const,
  credential: (companyId: string, sunatProfileId: string) => [...cpeValidationKeys.all, "credential", companyId, sunatProfileId] as const,
};

function useIds() {
  const { auth } = useAuth();
  return { companyId: auth?.company?.id ?? "", userId: auth?.user?.id ?? "" };
}

export function useCpeValidationAccess(enabled = true) {
  const { companyId, userId } = useIds();
  return useQuery({
    queryKey: cpeValidationKeys.access(companyId, userId),
    queryFn: ({ signal }) => getCpeValidationAccessApi(signal),
    enabled: enabled && Boolean(companyId),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useCpeValidationCredential(sunatProfileId: string, enabled = true) {
  const { companyId } = useIds();
  return useQuery({
    queryKey: cpeValidationKeys.credential(companyId, sunatProfileId),
    queryFn: ({ signal }) => getCpeValidationCredentialApi(sunatProfileId, signal),
    enabled: enabled && Boolean(companyId) && Boolean(sunatProfileId),
    retry: false,
    staleTime: 60_000,
  });
}
