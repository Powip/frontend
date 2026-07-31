import { toDate } from "@/utils/to-date";
import { OrderItemResponseDto } from "../dto/order.dto";
import { OrderItem } from "@/models/sales/order-item";

export function toOrderItem(
  dto: OrderItemResponseDto
): OrderItem {
  return {
    id: dto.id,

    productVariantId: dto.productVariantId,

    sku: dto.sku,
    productName: dto.productName,

    attributes: dto.attributes,

    quantity: dto.quantity,

    unitPrice: Number(dto.unitPrice),
    subtotal: Number(dto.subtotal),

    discountType: dto.discountType,
    discountAmount: Number(dto.discountAmount),

    isPromoItem: dto.isPromoItem,

    addedByUserId: dto.addedByUserId,
    addedAt: toDate(dto.addedAt),

    brandId: dto.brandId,
    brandName: dto.brandName,

    categoryId: dto.categoryId,
    categoryName: dto.categoryName,

    externalData: dto.externalData,
    imageUrl: dto.imageUrl,

    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}
