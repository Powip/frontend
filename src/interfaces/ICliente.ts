export type ClientType = "TRADICIONAL" | "MAYORISTA";
export type DocumentType = "DNI" | "CARNET" | "PASAPORTE";

export type DeliveryZone =
  | "LIMA_NORTE"
  | "CALLAO"
  | "LIMA_CENTRO"
  | "LIMA_SUR"
  | "LIMA_ESTE"
  | "ZONAS_ALEDANAS"
  | "PROVINCIAS";

export interface Client {
  id: string;
  companyId: string;
  fullName: string;
  phoneNumber?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  clientType: ClientType;
  province: string;
  city: string;
  district: string;
  address: string;
  reference?: string;
  zone?: DeliveryZone;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  isActive: boolean;
  // Estadísticas de compras (opcionales, vienen del backend si disponibles)
  totalPurchases?: number; // Número total de compras
  totalPurchaseAmount?: number | string | null; // Scalar only when the persisted currency is unique
  purchaseCurrency?: string | null;
  purchaseAmountsByCurrency?: { currency: string | null; amount: string }[];
  lastPurchaseDate?: string; // Fecha de última compra
}
