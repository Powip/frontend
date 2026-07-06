import { Provider, ProviderRequest } from "../interfaces/IProvider";
import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.supplier;

export async function getProvidersByCompany(companyId: string): Promise<Provider[]> {
  try {
    const res = await axiosAuth.get(`${API_URL}/suppliers/company/${companyId}`);
    return res.data;
  } catch (error) {
    console.error("Error en getProvidersByCompany:", error);
    throw error;
  }
}

export async function createProvider(provider: Provider): Promise<Provider> {
  const res = await axiosAuth.post(`${API_URL}/suppliers`, provider);
  return res.data;
}

export async function getProviderById(id: string) {
  const res = await axiosAuth.get(`${API_URL}/suppliers/${id}`);
  return res.data;
}

export async function inactivateProvider(id: string) {
  const res = await axiosAuth.patch(`${API_URL}/suppliers/disabled/${id}`);
  return res.data;
}

export async function updateProvider(id: string, providerData: ProviderRequest) {
  const res = await axiosAuth.patch(`${API_URL}/suppliers/${id}`, providerData);
  return res.data;
}
