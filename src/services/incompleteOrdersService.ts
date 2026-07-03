import axios from 'axios';
import { OrderHeader } from '@/interfaces/IOrder';

const BASE = process.env.NEXT_PUBLIC_API_VENTAS;

export async function getIncompleteOrders(storeId: string): Promise<OrderHeader[]> {
  const res = await axios.get<OrderHeader[]>(
    `${BASE}/order-header/store/${storeId}/incomplete`,
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
  const res = await axios.patch<OrderHeader>(
    `${BASE}/order-header/${orderId}/repair`,
    data,
  );
  return res.data;
}

export async function confirmOrder(orderId: string): Promise<OrderHeader> {
  const res = await axios.patch<OrderHeader>(
    `${BASE}/order-header/${orderId}/confirm`,
  );
  return res.data;
}
