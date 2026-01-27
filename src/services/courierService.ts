import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_COURIER; // ms-courier base URL

export interface Courier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  companyId: string;
  isActive: boolean;
  created_at: string;
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
  const response = await axios.get(`${API_URL}/couriers/company/${companyId}`);
  return response.data;
};

export const fetchCourierGuides = async (
  courierId: string,
): Promise<ShippingGuide[]> => {
  const response = await axios.get(`${API_URL}/couriers/${courierId}/guides`);
  return response.data;
};

export const createCourier = async (
  data: Partial<Courier>,
): Promise<Courier> => {
  const response = await axios.post(`${API_URL}/couriers`, data);
  return response.data;
};

export const updateCourier = async (
  id: string,
  data: Partial<Courier>,
): Promise<Courier> => {
  const response = await axios.patch(`${API_URL}/couriers/${id}`, data);
  return response.data;
};

export const deleteCourier = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/couriers/${id}`);
};
