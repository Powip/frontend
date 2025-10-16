export interface Brand {
  id: string;
  name: string;
  description?: string;
  supplier_id: string;
}

export interface Provider {
  id?: string;
  name: string;
  ruc: string;
  phone_number?: string;
  cell_phone?: string;
  company_id: string;
  contact?: string;
  address?: string;
  country?: string;
  departament?: string;
  province?: string;
  district?: string;
  zipCode?: string;
  webUrl?: string;
  email?: string;
  description?: string;
  is_active: boolean;

  // relación con marcas
  brands?: Brand[];
}

export interface ProviderRequest {
  name: string;
  ruc: string;
  phone_number: string;
  cell_phone: string;
  company_id: string;
  contact: string;
  address: string;
  country: string;
  departament: string;
  province: string;
  district: string;
  zipCode: string;
  webUrl: string;
  email: string;
  description: string;
  is_active: boolean;
}
