import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type {
  AlbumItem,
  AlbumItemInput,
  AlbumStatus,
  CatalogLink,
  CatalogResult,
  CommissionBase,
  CommissionRule,
  CommissionsReport,
  ObjectionDetection,
  SalesBoardRow,
  SalesFilter,
  SheetCore,
} from "@/types/crmSalesTools";

const BASE = `${API.crm}/crm`;
const enc = encodeURIComponent;

// --- Catálogo del Core (fila 49) ---

export async function searchCoreCatalog(search?: string, storeId?: string): Promise<CatalogResult> {
  const params: Record<string, string> = {};
  if (search?.trim()) params.search = search.trim();
  if (storeId) params.storeId = storeId;
  return (await axiosAuth.get<CatalogResult>(`${BASE}/content/core-catalog`, { params })).data;
}

export async function getSheetCore(sheetId: string, storeId?: string): Promise<SheetCore> {
  return (
    await axiosAuth.get<SheetCore>(`${BASE}/content/sheets/${enc(sheetId)}/core`, {
      params: storeId ? { storeId } : undefined,
    })
  ).data;
}

// --- Álbum por producto (fila 48) ---

export async function listAlbum(sheetId: string): Promise<AlbumItem[]> {
  return (await axiosAuth.get<AlbumItem[]>(`${BASE}/content/sheets/${enc(sheetId)}/album`)).data;
}

/** El administrador publica directo; la vendedora propone (queda pendiente de revisión). */
export async function addAlbumItem(sheetId: string, input: AlbumItemInput): Promise<AlbumItem> {
  return (await axiosAuth.post<AlbumItem>(`${BASE}/content/sheets/${enc(sheetId)}/album`, input)).data;
}

/** Solo administrador. */
export async function reviewAlbumItem(
  sheetId: string,
  itemId: string,
  status: Exclude<AlbumStatus, "pending">,
): Promise<AlbumItem> {
  return (
    await axiosAuth.patch<AlbumItem>(`${BASE}/content/sheets/${enc(sheetId)}/album/${enc(itemId)}`, { status })
  ).data;
}

/** Solo administrador. */
export async function reorderAlbum(sheetId: string, ids: string[]): Promise<AlbumItem[]> {
  return (
    await axiosAuth.put<AlbumItem[]>(`${BASE}/content/sheets/${enc(sheetId)}/album/order`, { ids })
  ).data;
}

export async function removeAlbumItem(sheetId: string, itemId: string): Promise<void> {
  await axiosAuth.delete(`${BASE}/content/sheets/${enc(sheetId)}/album/${enc(itemId)}`);
}

/** Enlace público (30 días) con fotos, precios y stock de las fichas elegidas. */
export async function createCatalogLink(sheetIds?: string[], businessName?: string): Promise<CatalogLink> {
  return (await axiosAuth.post<CatalogLink>(`${BASE}/content/catalog-link`, { sheetIds, businessName })).data;
}

// --- Objeciones (fila 50) ---

/** Con `conversationId` analiza el último mensaje del cliente; con `text`, ese texto. */
export async function detectObjection(input: { conversationId?: string; text?: string }): Promise<ObjectionDetection> {
  return (await axiosAuth.post<ObjectionDetection>(`${BASE}/content/objections/detect`, input)).data;
}

// --- Comisiones (fila 51) ---

export async function getCommissions(days = 30): Promise<CommissionsReport> {
  return (await axiosAuth.get<CommissionsReport>(`${BASE}/team/commissions`, { params: { days } })).data;
}

/** Solo supervisor o administrador. */
export async function updateCommissionRule(percent: number, base: CommissionBase): Promise<CommissionRule> {
  return (await axiosAuth.patch<CommissionRule>(`${BASE}/team/commissions`, { percent, base })).data;
}

// --- Ventas del Core desde el CRM (fila 58) ---

export async function getSalesBoard(status: SalesFilter, days = 60): Promise<SalesBoardRow[]> {
  return (
    await axiosAuth.get<SalesBoardRow[]>(`${BASE}/sales/board`, { params: { status, days } })
  ).data;
}

export async function refreshQuote(quoteId: string): Promise<{ synced: boolean }> {
  return (await axiosAuth.post<{ synced: boolean }>(`${BASE}/sales/quotes/${enc(quoteId)}/refresh`)).data;
}

export { crmError as crmSalesToolsError } from "@/services/crmService";
