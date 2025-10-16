export interface IProductVariantRequest {
  price: number;
  sku?: string | null;
  productId: string;
  attributeTypeId: string;
  attributeId: string;
  attributeTypeId2?: string;
  attributeId2?: string;
}
