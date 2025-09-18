
// INTERFACES DE PRODUCTOS
export interface IGetCategory {
  id: string;
  name: string;
  description: string;
  sku: string;
  status: boolean;
}

export interface IGetSubCategory {
  id: string;
  name: string;
  description: string;
  sku: string;
  status: boolean;
  category: IGetCategory;
  attribute_type_ids: string[];
  created_at: string;
  updated_at: string; 
}

export interface IGetBrand {
  id: string;
  name: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface IGetProducts {
  id: string;
  name: string;
  description: string;
  priceBase: number;
  priceVta: number;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  companyId: string;
  brandId: string;
  availability: boolean;
  status: boolean;
  images: string[];
  created_at: string;
  updated_at: string; 
}


export interface IProductFilters {
  companyId?: string;
  status?: boolean;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
  name?: string;
  description?: string;
}

// INTERFACES DE COMPAÑIAS

export interface IGetCompany {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  is_active: boolean;
  owner_id: string;
  cuit: string;
  billing_address: string;
  phone: string;
  billing_email: string;
  currency: string;
  language: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  disabled_at: string | null;
  enabled_at: string | null;
}
