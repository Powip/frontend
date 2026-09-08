import type { DiscountType } from "@/features/sales/types/order.types";

export interface OrderItem {
  id: string;

  productVariantId: string | null;

  sku: string;
  productName: string;

  attributes?: Record<string, string>;

  quantity: number;

  unitPrice: number;
  subtotal: number;
  discountAmount: number;

  discountType: DiscountType;

  isPromoItem: boolean;

  addedByUserId: string | null;
  addedAt: Date | null;

  brandId: string | null;
  brandName: string | null;

  categoryId: string | null;
  categoryName: string | null;

  externalData: unknown;
  imageUrl: string | null;

  createdAt: Date;
  updatedAt: Date;
}
