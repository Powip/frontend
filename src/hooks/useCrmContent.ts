"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createMaterial,
  createObjection,
  createSheet,
  crmContentError,
  deleteMaterial,
  deleteObjection,
  deleteSheet,
  getObjectionStats,
  getScript,
  getScriptReads,
  listMaterials,
  listObjections,
  listSheets,
  markScriptRead,
  proposeObjection,
  registerObjectionUse,
  saveScript,
  updateMaterial,
  updateObjection,
  updateSheet,
} from "@/services/crmContentService";
import type {
  MaterialInput,
  MaterialUpdate,
  ObjectionInput,
  ObjectionUpdate,
  Script,
  ScriptInput,
  SheetInput,
  SheetUpdate,
} from "@/types/crmContent";

export const contentKeys = {
  all: ["crm", "content"] as const,
  script: ["crm", "content", "script"] as const,
  scriptReads: ["crm", "content", "script-reads"] as const,
  objections: ["crm", "content", "objections"] as const,
  objectionStats: (days: number) => ["crm", "content", "objection-stats", days] as const,
  sheets: (search: string) => ["crm", "content", "sheets", search] as const,
  materials: (sheetId: string) => ["crm", "content", "materials", sheetId] as const,
};

const onError = (err: unknown) => toast.error(crmContentError(err).message);

// --- Guion ---

/** Lectura abierta a cualquier usuario. */
export function useScript(enabled = true) {
  return useQuery({ queryKey: contentKeys.script, queryFn: getScript, enabled, retry: false, staleTime: 30_000 });
}

export function useSaveScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScriptInput) => saveScript(input),
    onSuccess: (script) => {
      qc.setQueryData<Script>(contentKeys.script, script);
      qc.invalidateQueries({ queryKey: contentKeys.scriptReads });
    },
    onError,
  });
}

export function useMarkScriptRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markScriptRead(),
    onSuccess: (script) => qc.setQueryData<Script>(contentKeys.script, script),
    onError,
  });
}

/** Solo administrador. */
export function useScriptReads(enabled = true) {
  return useQuery({ queryKey: contentKeys.scriptReads, queryFn: getScriptReads, enabled, retry: false });
}

// --- Objeciones ---

export function useObjections(enabled = true) {
  return useQuery({
    queryKey: contentKeys.objections,
    queryFn: listObjections,
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

/** Solo administrador. */
export function useObjectionStats(days = 30, enabled = true) {
  return useQuery({
    queryKey: contentKeys.objectionStats(days),
    queryFn: () => getObjectionStats(days),
    enabled,
    retry: false,
  });
}

export function useObjectionActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: contentKeys.objections });
    qc.invalidateQueries({ queryKey: [...contentKeys.all, "objection-stats"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: ObjectionInput) => createObjection(input),
      onSuccess: refresh,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ObjectionUpdate }) => updateObjection(id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteObjection(id),
      onSuccess: () => {
        refresh();
        toast.success("Objeción eliminada");
      },
      onError,
    }),
  };
}

/** «Enseñarle la respuesta a Pau»: queda pendiente de aprobación, salvo que proponga un administrador. */
export function useProposeObjection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ObjectionInput) => proposeObjection(input),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: contentKeys.objections });
      toast.success(
        o.active
          ? "Respuesta guardada: Pau ya la usa"
          : "Propuesta enviada: queda pendiente hasta que un administrador la apruebe",
      );
    },
    onError,
  });
}

/** Registra el uso de una respuesta en un chat. Un fallo no debe estorbar a la vendedora. */
export function useRegisterObjectionUse(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (objectionId: string) => registerObjectionUse(conversationId, objectionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...contentKeys.all, "objection-stats"] }),
  });
}

// --- Fichas y material ---

export function useSheets(search = "", enabled = true) {
  const q = search.trim();
  return useQuery({
    queryKey: contentKeys.sheets(q),
    queryFn: () => listSheets(q),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
}

export function useGeneralMaterials(enabled = true) {
  return useQuery({
    queryKey: contentKeys.materials("general"),
    queryFn: () => listMaterials("general"),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSheetActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: [...contentKeys.all, "sheets"] });
  return {
    create: useMutation({
      mutationFn: (input: SheetInput) => createSheet(input),
      onSuccess: refresh,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: SheetUpdate }) => updateSheet(id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteSheet(id),
      onSuccess: () => {
        refresh();
        toast.success("Producto eliminado");
      },
      onError,
    }),
  };
}

export function useMaterialActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: [...contentKeys.all, "materials"] });
    qc.invalidateQueries({ queryKey: [...contentKeys.all, "sheets"] });
  };
  return {
    create: useMutation({
      mutationFn: (input: MaterialInput) => createMaterial(input),
      onSuccess: refresh,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: MaterialUpdate }) => updateMaterial(id, input),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteMaterial(id),
      onSuccess: refresh,
      onError,
    }),
  };
}
