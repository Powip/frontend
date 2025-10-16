export interface IProduct {
  name: string;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  supplierId: string;
  brandId: string;
  priceCpra: number;
  priceVta: number;
  observations: string;
  images: string[];
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
