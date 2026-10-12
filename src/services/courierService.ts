import axios from "@/lib/axiosAuth";

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

export const fetchCouriers = async (
  companyId: string,
  options?: { signal?: AbortSignal; accessToken?: string },
): Promise<Courier[]> => {
  const response = await axios.get(`${API_URL}/couriers/company/${companyId}`, {
    signal: options?.signal,
    headers: options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : undefined,
    timeout: 15_000,
  });
  if (!Array.isArray(response.data) || response.data.some((courier) =>
    !courier || typeof courier.id !== "string" || typeof courier.name !== "string" ||
    (courier.companyId && courier.companyId !== companyId)
  )) {
    throw new Error("No se pudieron cargar los couriers de la empresa.");
  }
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
