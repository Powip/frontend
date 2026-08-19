import axios from "axios";

const API_COURIER = process.env.NEXT_PUBLIC_API_COURIER;

export interface DashboardShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  status: string;
  deliveryType: string;
  amountToCollect?: number | null;
  created_at: string;
  updated_at: string;
}

export async function getShippingGuidesByStore(storeId: string): Promise<DashboardShippingGuide[]> {
  const res = await axios.get<DashboardShippingGuide[]>(
    `${API_COURIER}/shipping-guides/store/${storeId}`,
  );
  return res.data;
}
