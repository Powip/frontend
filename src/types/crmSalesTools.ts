/** Herramientas de venta del CRM conectadas al Core (filas 48-51 y 58). */

export interface CatalogItem {
  productVariantId: string;
  productId: string;
  name: string;
  variant: string;
  sku: string | null;
  unitPrice: number;
  /** `null` = el Core no confirmó el stock (no es lo mismo que 0). */
  stockAvailable: number | null;
  imageUrl: string | null;
}

export interface CatalogResult {
  /** `mock` = catálogo de demostración (falta INTERNAL_API_KEY en ms-crm). */
  source: "core" | "mock";
  items: CatalogItem[];
}

export interface SheetCore extends CatalogResult {
  linked: boolean;
  error?: string;
}

export type AlbumKind = "photo" | "video";
export type AlbumStatus = "published" | "pending" | "rejected";

export interface AlbumItem {
  id: string;
  sheetId: string;
  kind: AlbumKind;
  title: string;
  url: string;
  position: number;
  status: AlbumStatus;
  proposedById: string | null;
  proposedByName: string | null;
  reviewedByName: string | null;
  createdAt: string;
}

export interface AlbumItemInput {
  kind: AlbumKind;
  title: string;
  url: string;
}

export interface CatalogLink {
  url: string;
  expiresAt: string;
}

export interface ObjectionDetection {
  objectionId: string | null;
  label: string | null;
  confidence: number;
  suggestedResponse: string | null;
  /** `llm` = IA configurada en Pau · `mock` = reglas por palabras clave. */
  source: "llm" | "mock";
  text: string;
}

export type CommissionBase = "paid" | "total";

export interface CommissionRule {
  percent: number;
  base: CommissionBase;
  /** true = no se configuró: se usa la regla por defecto (5 % de lo cobrado). */
  isDefault: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface MemberCommission {
  userId: string;
  userName: string | null;
  orders: number;
  cancelled: number;
  sold: number;
  collected: number;
  commission: number;
}

export interface CommissionsReport {
  days: number;
  rule: CommissionRule;
  members: MemberCommission[];
  totals: Omit<MemberCommission, "userId" | "userName"> | null;
  /** La vendedora solo ve su propia fila. */
  onlyMine: boolean;
}

export type SalesBucket = "pending" | "cancelled" | "done";
export type SalesFilter = "pending" | "cancelled" | "all";

export interface SalesBoardRow {
  kind: "quote" | "order";
  id: string;
  coreId: string;
  number: string | null;
  conversationId: string;
  contactName: string | null;
  channel: string | null;
  sellerId: string | null;
  sellerName: string | null;
  status: string | null;
  total: number | null;
  paid: number;
  publicUrl: string | null;
  orderId: string | null;
  createdAt: string;
  bucket: SalesBucket;
}
