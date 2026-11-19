"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getGreSettingsApi,
  getUbigeoApi,
  listAllDespatchAdvicesApi,
  listDespatchAdvicesApi,
  listUbigeoOptionsApi,
  resolveUbigeoApi,
} from "../api/despatch-advice.api";
import type { ListDespatchAdvicesQuery } from "../types/despatch-advice.types";

// FEAT-24 H12 — lecturas de la GRE. Las claves llevan la empresa: al cambiar de
// empresa no se muestra la lista (ni las credenciales) de la anterior.

export const greKeys = {
  all: ["despatch-advices"] as const,
  settings: (companyId: string) => [...greKeys.all, "settings", companyId] as const,
  lists: () => [...greKeys.all, "list"] as const,
  list: (companyId: string, query: ListDespatchAdvicesQuery) => [...greKeys.lists(), companyId, query] as const,
  report: (companyId: string) => [...greKeys.lists(), companyId, "report"] as const,
};

export const ubigeoKeys = {
  options: (parent: string) => ["ubigeo", "options", parent] as const,
  code: (ubigeo: string) => ["ubigeo", "code", ubigeo] as const,
  resolve: (names: { department: string; province: string; district: string }) => ["ubigeo", "resolve", names] as const,
};

function useCompanyId(): string {
  const { auth } = useAuth();
  return auth?.company?.id ?? "";
}

/** Conexión con SUNAT y credenciales GRE de cada RUC de la empresa. */
export function useGreSettings(enabled = true) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: greKeys.settings(companyId),
    queryFn: ({ signal }) => getGreSettingsApi(signal),
    enabled: enabled && Boolean(companyId),
    retry: false,
    staleTime: 60_000,
  });
}

export function useDespatchAdvices(query: ListDespatchAdvicesQuery, enabled = true) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: greKeys.list(companyId, query),
    queryFn: ({ signal }) => listDespatchAdvicesApi(query, signal),
    enabled: enabled && Boolean(companyId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Todas las guías de la empresa, para el registro de Reportes. */
export function useDespatchAdvicesReport(enabled = true) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: greKeys.report(companyId),
    queryFn: () => listAllDespatchAdvicesApi({}),
    enabled: enabled && Boolean(companyId),
    retry: false,
  });
}

/** Un nivel del catálogo INEI ("" = departamentos). No cambia: se pide una vez. */
export function useUbigeoOptions(parent: string, enabled = true) {
  return useQuery({
    queryKey: ubigeoKeys.options(parent),
    queryFn: ({ signal }) => listUbigeoOptionsApi(parent, signal),
    enabled,
    retry: false,
    staleTime: Infinity,
  });
}

/** Nombres INEI de un código de 6 dígitos (404 = no es un distrito). */
export function useUbigeoLookup(ubigeo: string) {
  return useQuery({
    queryKey: ubigeoKeys.code(ubigeo),
    queryFn: ({ signal }) => getUbigeoApi(ubigeo, signal),
    enabled: /^\d{6}$/.test(ubigeo),
    retry: false,
    staleTime: Infinity,
  });
}

/** Nombres de la dirección → ubigeo INEI (nunca adivina: si no cruza, `resolved: false`). */
export function useUbigeoResolve(names: { department: string; province: string; district: string } | null) {
  return useQuery({
    queryKey: ubigeoKeys.resolve(names ?? { department: "", province: "", district: "" }),
    queryFn: ({ signal }) => resolveUbigeoApi(names ?? {}, signal),
    enabled: Boolean(names && (names.department || names.province || names.district)),
    retry: false,
    staleTime: Infinity,
  });
}
