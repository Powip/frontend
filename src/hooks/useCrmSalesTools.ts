"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addAlbumItem,
  createCatalogLink,
  crmSalesToolsError,
  detectObjection,
  getCommissions,
  getSalesBoard,
  getSheetCore,
  listAlbum,
  refreshQuote,
  removeAlbumItem,
  reorderAlbum,
  reviewAlbumItem,
  searchCoreCatalog,
  updateCommissionRule,
} from "@/services/crmSalesToolsService";
import type { AlbumItemInput, CommissionBase, SalesFilter } from "@/types/crmSalesTools";

export const salesToolsKeys = {
  all: ["crm", "sales-tools"] as const,
  catalog: (search: string) => ["crm", "sales-tools", "catalog", search] as const,
  sheetCore: (sheetId: string) => ["crm", "sales-tools", "sheet-core", sheetId] as const,
  album: (sheetId: string) => ["crm", "sales-tools", "album", sheetId] as const,
  objection: (key: string) => ["crm", "sales-tools", "objection", key] as const,
  commissions: (days: number) => ["crm", "sales-tools", "commissions", days] as const,
  board: (status: SalesFilter, days: number) => ["crm", "sales-tools", "board", status, days] as const,
};

const onError = (err: unknown) => toast.error(crmSalesToolsError(err).message);

// --- Catálogo del Core ---

export function useCoreCatalog(search: string, enabled = true) {
  return useQuery({
    queryKey: salesToolsKeys.catalog(search),
    queryFn: () => searchCoreCatalog(search),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSheetCore(sheetId: string | null) {
  return useQuery({
    queryKey: salesToolsKeys.sheetCore(sheetId ?? ""),
    queryFn: () => getSheetCore(sheetId as string),
    enabled: !!sheetId,
    retry: false,
    staleTime: 30_000,
  });
}

// --- Álbum ---

export function useAlbum(sheetId: string | null) {
  return useQuery({
    queryKey: salesToolsKeys.album(sheetId ?? ""),
    queryFn: () => listAlbum(sheetId as string),
    enabled: !!sheetId,
    retry: false,
  });
}

export function useAlbumActions(sheetId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: salesToolsKeys.album(sheetId) });
  const add = useMutation({
    mutationFn: (input: AlbumItemInput) => addAlbumItem(sheetId, input),
    onSuccess: (item) => {
      toast.success(item.status === "pending" ? "Propuesta enviada para revisión" : "Agregado al álbum");
      invalidate();
    },
    onError,
  });
  const review = useMutation({
    mutationFn: (v: { itemId: string; status: "published" | "rejected" }) => reviewAlbumItem(sheetId, v.itemId, v.status),
    onSuccess: invalidate,
    onError,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderAlbum(sheetId, ids),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => removeAlbumItem(sheetId, itemId),
    onSuccess: invalidate,
    onError,
  });
  return { add, review, reorder, remove };
}

export function useCatalogLink() {
  return useMutation({
    mutationFn: (v: { sheetIds?: string[]; businessName?: string }) => createCatalogLink(v.sheetIds, v.businessName),
    onError,
  });
}

// --- Objeciones ---

/**
 * Detecta la objeción del último mensaje del cliente. `trigger` cambia con cada
 * mensaje entrante (lastInboundAt), así no se vuelve a llamar sin motivo.
 */
export function useDetectObjection(conversationId: string | null, trigger: string | null, enabled = true) {
  return useQuery({
    queryKey: salesToolsKeys.objection(`${conversationId ?? ""}:${trigger ?? ""}`),
    queryFn: () => detectObjection({ conversationId: conversationId as string }),
    enabled: enabled && !!conversationId && !!trigger,
    retry: false,
    staleTime: Infinity,
  });
}

/** Prueba manual con un texto (pantalla Objeciones). */
export function useTestObjection() {
  return useMutation({ mutationFn: (text: string) => detectObjection({ text }), onError });
}

// --- Comisiones ---

export function useCommissions(days: number) {
  return useQuery({
    queryKey: salesToolsKeys.commissions(days),
    queryFn: () => getCommissions(days),
    retry: false,
  });
}

export function useUpdateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { percent: number; base: CommissionBase }) => updateCommissionRule(v.percent, v.base),
    onSuccess: () => {
      toast.success("Regla de comisión guardada");
      qc.invalidateQueries({ queryKey: ["crm", "sales-tools", "commissions"] });
    },
    onError,
  });
}

// --- Ventas ---

export function useSalesBoard(status: SalesFilter, days = 60) {
  return useQuery({
    queryKey: salesToolsKeys.board(status, days),
    queryFn: () => getSalesBoard(status, days),
    retry: false,
  });
}

export function useRefreshQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => refreshQuote(quoteId),
    onSuccess: (r) => {
      toast[r.synced ? "success" : "warning"](r.synced ? "Cotización actualizada desde el Core" : "El Core no respondió");
      qc.invalidateQueries({ queryKey: ["crm", "sales-tools", "board"] });
    },
    onError,
  });
}
