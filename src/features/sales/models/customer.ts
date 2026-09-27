import type { ClientType, DocumentType } from "@/features/sales/types/order.types";

export interface Customer {
  id: string;
  companyId: string;

  documentType: DocumentType;
  documentNumber: string;

  fullName: string;
  phoneNumber: string;
  email: string | null;

  clientType: ClientType;

  province: string;
  city: string;
  district: string;
  address: string;
  reference: string | null;
  zone: string;

  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}
