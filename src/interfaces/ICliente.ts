export type ClientType = "TRADICIONAL" | "MAYORISTA";
export type DocumentType = "DNI" | "CUIT" | "PASAPORTE";

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
  isActive: boolean;
}

