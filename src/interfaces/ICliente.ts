export type ClientType = "TRADICIONAL" | "MAYORISTA";
export type DocumentType = "DNI" | "CUIT" | "PASAPORTE";

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
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}
