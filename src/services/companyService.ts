import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

interface Store {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
  userId: string;
  stores?: Store[];
  cuit?: string;
  billingAddress?: string;
  phone?: string;
  billingEmail?: string;
  logoUrl?: string;
  sales_channels?: string[];
  closing_channels?: string[];
  createdAt?: string;
  iva?: number;
  powipCommissionRate?: number;
}

const mapCompany = (c: any): Company => ({
  id: c.id,
  name: c.name,
  userId: c.user_id,
  stores: c.stores || [],
  cuit: c.cuit,
  billingAddress: c.billing_address,
  phone: c.phone,
  logoUrl: c.logo_url,
  sales_channels: c.sales_channels,
  closing_channels: c.closing_channels,
  billingEmail: c.billing_email,
  iva: c.iva != null ? Number(c.iva) : undefined,
  powipCommissionRate: c.powipCommissionRate != null ? Number(c.powipCommissionRate) : undefined,
});

export const fetchUserCompany = async (
  userId: string,
): Promise<Company | null> => {
  try {
    const response = await axiosAuth.get(`${GATEWAY.company}/company/user/${userId}`);
    return response.data ? mapCompany(response.data) : null;
  } catch (err) {
    // 404 confirmado por el backend: el usuario no tiene empresa
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    // Cualquier otro error (401, red, 5xx, etc.) no confirma nada — se propaga
    throw err;
  }
};

export const fetchCompanyById = async (
  companyId: string,
): Promise<Company | null> => {
  try {
    const response = await axiosAuth.get(`${GATEWAY.company}/company/${companyId}/with-stores`);
    return response.data ? mapCompany(response.data) : null;
  } catch (err) {
    // 404 confirmado por el backend: la empresa no existe
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    // Cualquier otro error (401, red, 5xx, etc.) no confirma nada — se propaga
    throw err;
  }
};

export const getAllCompanies = async (): Promise<Company[]> => {
  const response = await axiosAuth.get(`${GATEWAY.company}/company?includeStores=true`);
  return response.data.map((c: any) => ({
    ...mapCompany(c),
    createdAt: c.created_at,
  }));
};

export const createCompany = async (data: Partial<Company>) => {
  const response = await axiosAuth.post(`${GATEWAY.company}/company`, {
    name: data.name,
    user_id: data.userId,
    cuit: data.cuit,
    billing_address: data.billingAddress,
    phone: data.phone,
    billing_email: data.billingEmail,
  });
  return response.data;
};

export const updateCompany = async (
  companyId: string,
  data: Partial<Company>,
) => {
  const response = await axiosAuth.patch(`${GATEWAY.company}/company/${companyId}`, {
    name: data.name,
    cuit: data.cuit,
    billing_address: data.billingAddress,
    phone: data.phone,
    logo_url: data.logoUrl,
    sales_channels: data.sales_channels,
    closing_channels: data.closing_channels,
    powip_commission_rate: data.powipCommissionRate,
  });
  return response.data;
};

export const deleteCompany = async (companyId: string) => {
  const response = await axiosAuth.delete(`${GATEWAY.company}/company/${companyId}`);
  return response.data;
};
