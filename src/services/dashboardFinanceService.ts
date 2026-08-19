import axiosAuth from "@/lib/axiosAuth";

const BASE = process.env.NEXT_PUBLIC_API_VENTAS;

export interface BillingStat {
  month: number;
  monthName: string;
  currentYear: number;
  previousYear: number;
  currentOrders?: number;
  currentProducts?: number;
}

export async function getBilling(storeId: string, year: string, sellerId?: string): Promise<BillingStat[]> {
  const params = new URLSearchParams({ storeId, year });
  if (sellerId) params.set("sellerId", sellerId);
  const res = await axiosAuth.get<BillingStat[]>(`${BASE}/stats/billing?${params}`);
  return res.data;
}

export interface DailyIncome {
  date: string;
  amount: number;
}

export async function getDailyIncome(
  storeId: string,
  fromDate: string,
  toDate: string,
  sellerId?: string,
): Promise<DailyIncome[]> {
  const params = new URLSearchParams({ storeId, fromDate, toDate });
  if (sellerId) params.set("sellerId", sellerId);
  const res = await axiosAuth.get<DailyIncome[]>(`${BASE}/stats/daily-income?${params}`);
  return res.data;
}
