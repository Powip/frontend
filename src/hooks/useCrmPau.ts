"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmKeys } from "@/lib/crmSse";
import {
  createPauProvider,
  crmError,
  deletePauProvider,
  dismissPauProviderAlert,
  getPauProviderAlerts,
  getPauSettings,
  getPauUsage,
  listPauProviders,
  pauSandbox,
  suggestPauReply,
  testPauProvider,
  updatePauProvider,
  updatePauSettings,
} from "@/services/crmService";
import type {
  PauProviderNotice,
  PauProviderInput,
  PauProviderUpdate,
  PauSandboxTurn,
  PauSettingsInput,
} from "@/types/crm";

const onError = (err: unknown) => toast.error(crmError(err).message);

/** Aviso al equipo cuando respondió el proveedor de respaldo. Nunca va al cliente. */
export function toastProviderNotice(notice?: PauProviderNotice | null) {
  if (notice?.continuedWith) toast.warning(notice.message, { duration: 10_000 });
}

/**
 * Avisos de respaldo guardados (también de respuestas automáticas). Se revisan cada minuto
 * para verlos sin recargar. Si falla (permiso, red), simplemente no se muestran.
 */
export function usePauProviderAlerts(conversationId?: string) {
  return useQuery({
    queryKey: [...crmKeys.pauProviderAlerts, conversationId ?? "all"],
    queryFn: () => getPauProviderAlerts(conversationId),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDismissPauProviderAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissPauProviderAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: crmKeys.pauProviderAlerts }),
    onError,
  });
}

/** Lectura abierta a cualquier usuario. Si falla, el chat simplemente no muestra a Pau. */
export function usePauSettings() {
  return useQuery({
    queryKey: crmKeys.pauSettings,
    queryFn: getPauSettings,
    retry: false,
    staleTime: 30_000,
  });
}

export function useUpdatePauSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PauSettingsInput) => updatePauSettings(input),
    onSuccess: (settings) => {
      qc.setQueryData(crmKeys.pauSettings, settings);
      qc.invalidateQueries({ queryKey: crmKeys.pauUsage });
    },
    onError,
  });
}

// --- Solo administrador: no llamar si el usuario no lo es (`enabled`). ---

export function usePauProviders(enabled = true) {
  return useQuery({
    queryKey: crmKeys.pauProviders,
    queryFn: listPauProviders,
    enabled,
    retry: false,
  });
}

export function usePauUsage(enabled = true) {
  return useQuery({
    queryKey: crmKeys.pauUsage,
    queryFn: getPauUsage,
    enabled,
    retry: false,
  });
}

/**
 * Alta, edición, prueba y borrado de proveedores. Alta y edición NO usan
 * `useMutation` a propósito: sus variables llevan la llave y la caché de
 * react-query las conservaría en memoria global.
 */
export function usePauProviderActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: crmKeys.pauProviders });
    qc.invalidateQueries({ queryKey: crmKeys.pauSettings });
  };
  return {
    async create(input: PauProviderInput) {
      const provider = await createPauProvider(input);
      refresh();
      return provider;
    },
    async update(id: string, input: PauProviderUpdate) {
      const provider = await updatePauProvider(id, input);
      refresh();
      return provider;
    },
    async test(id: string) {
      const result = await testPauProvider(id);
      refresh();
      qc.invalidateQueries({ queryKey: crmKeys.pauUsage });
      return result;
    },
    remove: useMutation({
      mutationFn: (id: string) => deletePauProvider(id),
      onSuccess: () => {
        refresh();
        toast.success("Proveedor eliminado");
      },
      onError,
    }),
  };
}

/** Mini chat de ensayo: se manda todo el historial en cada turno. */
export function usePauSandbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (turns: PauSandboxTurn[]) => pauSandbox(turns),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: crmKeys.pauUsage });
      qc.invalidateQueries({ queryKey: crmKeys.pauProviderAlerts });
      toastProviderNotice(result.providerNotice);
    },
    onError: () => qc.invalidateQueries({ queryKey: crmKeys.pauProviderAlerts }),
  });
}

/** Pide un borrador a Pau. No envía nada: el llamador lo pone en la caja de texto. */
export function useSuggestPauReply(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => suggestPauReply(conversationId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: crmKeys.pauProviderAlerts });
      toastProviderNotice(result.providerNotice);
    },
    onError: (err: unknown) => {
      qc.invalidateQueries({ queryKey: crmKeys.pauProviderAlerts });
      onError(err);
    },
  });
}
