import { OrderLog } from "@/models/sales/order-log";
import { OrderLogResponseDto } from "../dto/order.dto";

export function toOrderLog(
  dto: OrderLogResponseDto
): OrderLog {
  return {
    id: dto.id,

    operation: dto.operacion,
    comments: dto.comentarios,

    userId: dto.userId,
    userName: dto.userName,

    data: dto.data,

    isSystemGenerated: dto.isSystemGenerated,

    timestamp: new Date(dto.timestamp),
  };
}
