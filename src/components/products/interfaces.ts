// Subcategorías
export interface ISubCategory {
  id: string;
  name: string;
  category: ICategory;
  description?: string;
  status?: boolean;
}
// Categorías
export interface ICategory {
  id: string;
  name: string;
  description?: string;
  status?: boolean;
}


// Marca
export interface IBrand {
  id: string;
  name: string;
  description?: string;
  status?: boolean;
}

//Proveedores
export interface IProvider {
  id: string;
  name: string;
  description?: string;
  status?: boolean;
}

// Compañía / Proveedor
export interface ICompany {
  id: string;
  name: string;
  description?: string;
  status?: boolean;
}

export interface IAttributeType {
  id: string;
  name: string;
}

export interface IAttributeValue {
  id: string;
  name: string;
}

export interface IProductVariant {
  id: string;
  sku?: string;
  price?: number;
  stock?: number;
  attributeType2: IAttributeType;
  attribute2: IAttributeValue;
}

export interface IProduct {
  id: string;
  name: string;
  description?: string;
  priceBase?: string | number;
  priceVta?: string | number | null;
  sku?: string;
  companyId?: string;

  // Relaciones
  brand?: IBrand | null;
  company?: ICompany | null;
  subcategory?: ISubCategory | null;
  category?: ICategory | null;

  // Variantes
  productVariants?: IProductVariant[];
}

export interface IAttributeType {
  id: string;
  name: string;
}

export interface IAttribute {
  id: string;
  name: string;
  attributeType: IAttributeType;
}


export type IAttributesGroupedMap = Record<string, IGroupedAttribute>;

export interface IAttributeValue {
  id: string;
  name: string;
}

// grupo de atributos por tipo 
export interface IGroupedAttribute {
  typeId: string;
  typeName: string;
  values: IAttributeValue[];
}

export interface ProductFilters {
  name: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  providerId: string
  status: boolean;
  [key: `attribute_${string}`]: string | undefined; // atributos dinámicos
}
