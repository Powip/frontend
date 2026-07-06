import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_URL = GATEWAY.courier;

export enum CourierSettlementModel {
  COURIER_COLLECTS_AND_SETTLES = "courier_collects_and_settles",
  BUSINESS_COLLECTS = "business_collects",
  PREPAID_SHIPPING = "prepaid_shipping",
}

export interface Courier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  companyId: string;
  isActive: boolean;
  created_at: string;
  settlementModel?: CourierSettlementModel;
}

export interface ShippingGuide {
  id: string;
  guideNumber: string;
  created_at: string;
  status: string;
  deliveryType: string;
  deliveryAddress?: string;
}

export const fetchCouriers = async (companyId: string): Promise<Courier[]> => {
  const response = await axiosAuth.get(`${API_URL}/couriers/company/${companyId}`);
  return response.data;
};

export const fetchCourierGuides = async (
  courierId: string,
): Promise<ShippingGuide[]> => {
  const response = await axiosAuth.get(`${API_URL}/couriers/${courierId}/guides`);
  return response.data;
};

export const createCourier = async (
  data: Partial<Courier>,
): Promise<Courier> => {
  const response = await axiosAuth.post(`${API_URL}/couriers`, data);
  return response.data;
};

export const updateCourier = async (
  id: string,
  data: Partial<Courier>,
): Promise<Courier> => {
  const response = await axiosAuth.patch(`${API_URL}/couriers/${id}`, data);
  return response.data;
};

export const deleteCourier = async (id: string): Promise<void> => {
  await axiosAuth.delete(`${API_URL}/couriers/${id}`);
};
