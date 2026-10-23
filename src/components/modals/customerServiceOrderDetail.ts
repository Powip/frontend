import type { OrderHeader } from "@/interfaces/IOrder";
import type { OrderReceipt } from "@/utils/printOrderLabel";
import { getOrderCollectionAmount } from "@/utils/orderCollectionAmount";

const amount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/** Data for the shared CC detail layout; it does not issue a sales receipt. */
export function buildPendingOrderDetail(order: OrderHeader): OrderReceipt {
  const payments = order.payments ?? [];
  const items = order.items ?? [];
  const totalPaid = roundMoney(
    payments.reduce(
      (sum, payment) =>
        payment.status === "PAID"
          ? sum + Math.max(0, amount(payment.amount))
          : sum,
      0,
    ),
  );
  const grandTotal = amount(order.grandTotal);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    receiptType: order.receiptType,
    status: order.status,
    createdAt: order.created_at,
    salesChannel: order.salesChannel,
    closingChannel: order.closingChannel,
    externalSource: order.externalSource,
    callStatus: order.callStatus ?? undefined,
    callAttempts: order.callAttempts ?? 0,
    callbackAt: order.callbackAt,
    customer: {
      id: order.customer?.id,
      fullName: order.customer?.fullName ?? "",
      phoneNumber: order.customer?.phoneNumber,
      dni: order.dniCliente ?? order.customer?.documentNumber,
      address: order.customer?.address,
      district: order.customer?.district,
      city: order.customer?.city,
      province: order.customer?.province,
      clientType: order.customer?.clientType,
      reference: order.referenciaEntrega ?? order.customer?.reference,
      googleMapsUrl: order.customer?.googleMapsUrl ?? null,
    },
    items: items.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: amount(item.unitPrice),
      subtotal: amount(item.subtotal),
      discountAmount: amount(item.discountAmount),
      attributes: item.attributes,
      isPromoItem: item.isPromoItem ?? false,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      paymentMethod: payment.paymentMethod,
      amount: amount(payment.amount),
      paymentDate: payment.paymentDate,
      status: payment.status,
    })),
    totals: {
      productsTotal: roundMoney(
        items.reduce((sum, item) => sum + amount(item.subtotal), 0),
      ),
      taxTotal: amount(order.taxTotal),
      shippingTotal: amount(order.shippingTotal),
      discountTotal: amount(order.discountTotal),
      grandTotal,
      totalPaid,
      pendingAmount: getOrderCollectionAmount({
        grandTotal,
        externalSource: order.externalSource,
        payments: payments.map((payment) => ({
          ...payment,
          amount: amount(payment.amount),
        })),
      }),
    },
    upsellOffered: order.externalData?.upsellOffered === true,
    upsellAccepted: order.externalData?.upsellAccepted === true,
    upsellDetails:
      typeof order.externalData?.upsellDetails === "string"
        ? order.externalData.upsellDetails
        : undefined,
  };
}
