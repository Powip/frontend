import axios from "axios";

const API_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;

export interface SellerStat {
  sellerId: string;
  sellerName: string;
  totalSales: number;
  orderCount: number;
  productsCount: number;
  averageTicket: number;
}

export async function getSellersSummary(
  companyId: string,
  fromDate: string,
  toDate: string,
): Promise<SellerStat[]> {
  const res = await axios.get<SellerStat[]>(
    `${API_VENTAS}/order-header/summary/company/${companyId}/sellers`,
    { params: { fromDate, toDate } },
  );
  return res.data;
}

export interface DeliveryBySeller {
  sellerId: string;
  deliveredCount: number;
  createdCount: number;
}

export async function getDeliveryBySeller(
  storeId: string,
  fromDate: string,
  toDate: string,
): Promise<DeliveryBySeller[]> {
  const res = await axios.get<DeliveryBySeller[]>(`${API_VENTAS}/stats/delivery-by-seller`, {
    params: { storeId, fromDate, toDate },
  });
  return res.data;
}
