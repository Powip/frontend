import { Order } from "@/models/sales/order";
import { OrderResponseDto } from "../dto/order.dto";
import { toCustomer } from "./to-customer.mapper";
import { toDate } from "@/utils/to-date";
import { toOrderItem } from "./to-order-item.mapper";
import { toPayment } from "./to-payment.mapper";
import { toOrderLog } from "./to-order-log.mapper";

export function toOrder(
  dto: OrderResponseDto
): Order {
  return {
    id: dto.id,

    receiptType: dto.receiptType,
    orderType: dto.orderType,

    orderNumber: dto.orderNumber,
    storeId: dto.storeId,

    customer: toCustomer(dto.customer),

    salesChannel: dto.salesChannel,
    closingChannel: dto.closingChannel,

    deliveryType: dto.deliveryType,

    courierId: dto.courierId,
    courier: dto.courier,
    guideNumber: dto.guideNumber,

    subtotal: Number(dto.subtotal),
    taxTotal: Number(dto.taxTotal),
    shippingTotal: Number(dto.shippingTotal),
    discountTotal: Number(dto.discountTotal),
    grandTotal: Number(dto.grandTotal),

    status: dto.status,

    salesRegion: dto.salesRegion,
    cancellationReason: dto.cancellationReason,

    notes: dto.notes,

    taxMode: dto.taxMode,

    callStatus: dto.callStatus,
    callAttempts: dto.callAttempts,
    callbackAt: toDate(dto.callbackAt),

    sellerId: dto.sellerId,
    sellerName: dto.sellerName,

    externalTrackingNumber: dto.externalTrackingNumber,
    shippingKey: dto.shippingKey,
    trackingUrl: dto.trackingUrl,
    shippingOffice: dto.shippingOffice,
    shippingCode: dto.shippingCode,
    shippingProofUrl: dto.shippingProofUrl,

    carrierShippingCost: Number(dto.carrierShippingCost),
    costAmount: Number(dto.costAmount),
    channelFee: Number(dto.channelFee),

    items: dto.items.map(toOrderItem),
    payments: dto.payments.map(toPayment),
    logs: dto.logs.map(toOrderLog),

    externalSource: dto.externalSource,
    externalData: dto.externalData,
    syncErrors: dto.syncErrors,

    shalomStatus: dto.shalomStatus,
    shalomError: dto.shalomError,
    shalomSerie: dto.shalomSerie,
    shalomOriginAgency: dto.shalomOriginAgency,
    shalomDestinationAgency: dto.shalomDestinationAgency,
    shalomRecipientDoc: dto.shalomRecipientDoc,
    shalomRecipientPhone: dto.shalomRecipientPhone,
    shalomContent: dto.shalomContent,

    canalOrigen: dto.canalOrigen,

    subEstadoCc: dto.subEstadoCc,
    ccAgenteId: dto.ccAgenteId,
    ccConfirmadoAt: toDate(dto.ccConfirmadoAt),
    ccConfirmadoBy: dto.ccConfirmadoBy,

    datosCompletos: dto.datosCompletos,
    dniCliente: dto.dniCliente,
    referenciaEntrega: dto.referenciaEntrega,
    horarioEntregaLima: dto.horarioEntregaLima,

    metaPubliId: dto.metaPubliId,

    aliclikDispatchStatus: dto.aliclikDispatchStatus,
    aliclikSyncedAt: toDate(dto.aliclikSyncedAt),

    sunatStatus: dto.sunatStatus,
    sunatSerie: dto.sunatSerie,
    sunatCorrelativo: dto.sunatCorrelativo,
    sunatCode: dto.sunatCode,
    sunatDescription: dto.sunatDescription,
    sunatObservations: dto.sunatObservations,
    sunatError: dto.sunatError,

    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),

    hasStockIssue: dto.hasStockIssue,

    shopifyOrderId: dto.shopifyOrderId,
    shopifyOrderNumber: dto.shopifyOrderNumber,

    discountCodes: dto.discountCodes,
  };
}
