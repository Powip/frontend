/** Mockup 152, Guion y material: K4 (aprobar testimonios) y K5 (catálogo). */

export type MaterialStatus = "published" | "pending" | "rejected";

export interface Testimony {
  id: string;
  sheetId: string | null;
  sheetName: string | null;
  title: string;
  url: string;
  status: MaterialStatus;
  proposedByName: string | null;
  reviewedByName: string | null;
  createdAt: string | null;
}

export interface TestimoniesResponse {
  items: Testimony[];
  /** Pendientes de toda la empresa (no depende del filtro). */
  pending: number;
}

export interface CatalogSettings {
  /** Viene de los ajustes del CRM (`settings.attribution_days`). */
  attributionDays: number;
  showSoldOut: boolean;
  pdfGeneratedAt: string | null;
  updatedByName: string | null;
}

export interface CatalogAttribution {
  days: number;
  since: string;
  orders: number;
  billed: number;
  bySeller: number;
  withoutSeller: number;
  sellers: Array<{ userId: string; userName: string | null; orders: number; billed: number }>;
}
