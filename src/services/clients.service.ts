import { Client } from "@/interfaces/ICliente";
import { GATEWAY } from "@/lib/gateway";
import axiosAuth from "@/lib/axiosAuth";
import axios from "axios";

const API_VENTAS = GATEWAY.ventas;

export async function fetchClientByPhone(
  companyId: string,
  phone: string
): Promise<Client | null> {
  try {
    const res = await axiosAuth.get(
      `${API_VENTAS}/clients/company/${companyId}/phone/${phone}`
    );
    const data = res.data;
    return {
      id: data.id,
      companyId: data.companyId,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      clientType: data.clientType,
      province: data.province,
      city: data.city,
      district: data.district,
      address: data.address,
      reference: data.reference,
      latitude: data.latitude,
      longitude: data.longitude,
      isActive: data.isActive,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw new Error("Error fetching client");
  }
}

export async function createClient(payload: {
  companyId: string;
  fullName: string;
  phoneNumber?: string;
  documentType?: string;
  documentNumber?: string;
  clientType: "TRADICIONAL" | "MAYORISTA";
  province: string;
  city: string;
  district: string;
  address: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
}): Promise<Client> {
  const res = await axiosAuth.post(`${API_VENTAS}/clients`, payload);
  return res.data;
}

export async function updateClient(
  id: string,
  payload: Partial<{
    companyId: string;
    fullName: string;
    phoneNumber?: string;
    documentType?: string;
    documentNumber?: string;
    clientType: "TRADICIONAL" | "MAYORISTA";
    province: string;
    city: string;
    district: string;
    address: string;
    reference?: string;
    latitude?: number;
    longitude?: number;
  }>
): Promise<Client> {
  const res = await axiosAuth.patch(`${API_VENTAS}/clients/${id}`, payload);
  return res.data;
}
