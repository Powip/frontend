import { Certificate } from "./certificate";

export interface SunatProfile {
  id: string;
  companyId: string;
  name: string;
  description: string;
  ruc: string;
  razonSocial: string;
  ubigeo: string;
  address: string;
  certificate: Certificate;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
