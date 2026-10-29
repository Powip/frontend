import axios from "axios";
import type { MonthlyOrderVolume } from "@/lib/onboardingQuestions";

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
  onboarding_sales_channels?: string[] | null;
  monthly_order_volume?: MonthlyOrderVolume | null;
  closing_channels?: string[];
  createdAt?: string;
  iva?: number;
  powipCommissionRate?: number;
}

export const fetchUserCompany = async (
  userId: string,
  token: string,
): Promise<Company | null> => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COMPANY}/company/user/${userId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Si no trae company
    if (!response.data) return null;

    // Mapear todos los campos de la company
    return {
      id: response.data.id,
      name: response.data.name,
      userId: response.data.user_id,
      stores: response.data.stores || [],
      cuit: response.data.cuit,
      billingAddress: response.data.billing_address,
      phone: response.data.phone,
      logoUrl: response.data.logo_url,
      sales_channels: response.data.sales_channels,
      onboarding_sales_channels: response.data.onboarding_sales_channels,
      monthly_order_volume: response.data.monthly_order_volume,
      closing_channels: response.data.closing_channels,
      billingEmail: response.data.billing_email,
      iva: response.data.iva != null ? Number(response.data.iva) : undefined,
      powipCommissionRate: response.data.powipCommissionRate != null ? Number(response.data.powipCommissionRate) : undefined,
    };
  } catch (error) {
    return null;
  }
};

export const fetchCompanyById = async (
  companyId: string,
  token: string,
): Promise<Company | null> => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${companyId}/with-stores`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.data) return null;

    return {
      id: response.data.id,
      name: response.data.name,
      userId: response.data.user_id,
      stores: response.data.stores || [],
      cuit: response.data.cuit,
      billingAddress: response.data.billing_address,
      phone: response.data.phone,
      logoUrl: response.data.logo_url,
      sales_channels: response.data.sales_channels,
      onboarding_sales_channels: response.data.onboarding_sales_channels,
      monthly_order_volume: response.data.monthly_order_volume,
      closing_channels: response.data.closing_channels,
      billingEmail: response.data.billing_email,
      iva: response.data.iva != null ? Number(response.data.iva) : undefined,
      powipCommissionRate: response.data.powipCommissionRate != null ? Number(response.data.powipCommissionRate) : undefined,
    };
  } catch (error) {
    console.error("Error al obtener company by id:", error);
    return null;
  }
};

export const getAllCompanies = async (token: string): Promise<Company[]> => {
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_API_COMPANY}/company?includeStores=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data.map((c: any) => ({
    id: c.id,
    name: c.name,
    userId: c.user_id,
    stores: c.stores || [],
    cuit: c.cuit,
    billingAddress: c.billing_address,
    phone: c.phone,
    logoUrl: c.logo_url,
    sales_channels: c.sales_channels,
    onboarding_sales_channels: c.onboarding_sales_channels,
    monthly_order_volume: c.monthly_order_volume,
    closing_channels: c.closing_channels,
    billingEmail: c.billing_email,
    createdAt: c.created_at,
  }));
};
export const createCompany = async (token: string, data: Partial<Company>) => {
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_API_COMPANY}/company`,
    {
      name: data.name,
      user_id: data.userId,
      cuit: data.cuit,
      billing_address: data.billingAddress,
      phone: data.phone,
      billing_email: data.billingEmail,
      sales_channels: data.sales_channels,
      onboarding_sales_channels: data.onboarding_sales_channels,
      monthly_order_volume: data.monthly_order_volume,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
};

export const updateCompany = async (
  companyId: string,
  token: string,
  data: Partial<Company>,
) => {
  const response = await axios.patch(
    `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${companyId}`,
    {
      name: data.name,
      cuit: data.cuit,
      billing_address: data.billingAddress,
      phone: data.phone,
      logo_url: data.logoUrl,
      sales_channels: data.sales_channels,
      closing_channels: data.closing_channels,
      powip_commission_rate: data.powipCommissionRate,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
};

export interface CompanyOnboardingQuestions {
  onboarding_sales_channels: string[];
  monthly_order_volume: MonthlyOrderVolume;
}

export type CompanyOnboardingProfile = CompanyOnboardingQuestions & { id: string };

export const submitCompanyOnboardingQuestions = async (
  companyId: string,
  token: string,
  answers: CompanyOnboardingQuestions,
): Promise<CompanyOnboardingProfile> => {
  const response = await axios.patch<CompanyOnboardingProfile>(
    `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${companyId}/onboarding-questions`,
    {
      onboarding_sales_channels: answers.onboarding_sales_channels,
      monthly_order_volume: answers.monthly_order_volume,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const deleteCompany = async (
  token: string,
  companyId: string,
) => {
  const response = await axios.delete(
    `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${companyId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
};
