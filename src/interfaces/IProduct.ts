export interface IProduct {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  supplierId: string;
  brandId: string;
  priceCpra?: number; // 👈 en tus payloads usás priceBase o priceVta
  priceVta: number;
  observations?: string;
  images: string[];

  // ✅ Relaciones opcionales (cuando se hace getProductById)
  description?: string;
  category?: {
    id: string;
    name: string;
    description?: string;
  };
  subcategory?: {
    id: string;
    name: string;
    description?: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
  brand?: {
    id: string;
    name: string;
  };
}

export interface IProductRequest {
  name: string;
  description: string;
  priceBase: number;
  priceVta: number;
  sku?: string | null;
  categoryId: string;
  subcategoryId: string;
  companyId: string;
  supplierId: string;
  brandId: string;
  availability: boolean;
  status: boolean;
  images: string[];
}

export interface IProductApiResponse {
  data: IProductResponse;
}

export interface IProductResponse extends IProductRequest {
  id: string;
}

export interface InventoryItemForSale {
  inventoryItemId: string;
  variantId: string;
  productName: string;
  sku: string;
  companySku?: string | null;
  price: number;
  priceBase?: number;
  priceVta?: number;
  availableStock: number;
  physicalStock: number;
  reservedStock?: number;
  min_stock?: number;
  attributes?: Record<string, string>;
  imageUrl?: string | null;
  // Pendientes de que ms-logistics los agregue a /inventory-item/search
  // (ver doc "Registrar Venta & Promos v2.1", sección 2/3). Opcionales para
  // que no rompa nada mientras el backend no los devuelva.
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
}
