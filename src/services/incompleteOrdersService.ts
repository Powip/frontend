import axiosAuth from '@/lib/axiosAuth';
import { GATEWAY } from '@/lib/gateway';
import { OrderHeader } from '@/interfaces/IOrder';

export async function getIncompleteOrders(storeId: string): Promise<OrderHeader[]> {
  const res = await axiosAuth.get<OrderHeader[]>(
    `${GATEWAY.ventas}/order-header/store/${storeId}/incomplete`,
  );
  return res.data;
}

export async function repairOrder(
  orderId: string,
  data: {
    customer?: {
      fullName?: string;
      phoneNumber?: string;
      province?: string;
      city?: string;
      district?: string;
      address?: string;
      reference?: string;
    };
    deliveryType?: string;
    salesRegion?: string;
    receiptType?: string;
    notes?: string;
  },
): Promise<OrderHeader> {
  const res = await axiosAuth.patch<OrderHeader>(
    `${GATEWAY.ventas}/order-header/${orderId}/repair`,
    data,
  );
  return res.data;
}

export async function confirmOrder(orderId: string): Promise<OrderHeader> {
  const res = await axiosAuth.patch<OrderHeader>(
    `${GATEWAY.ventas}/order-header/${orderId}/confirm`,
  );
  return res.data;
}
