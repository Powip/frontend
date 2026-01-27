import axios from "axios";

interface Store {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
  userId: string;
  stores?: Store[];
  // Datos adicionales para comprobante de envío
  cuit?: string; // RUC/CUIT
  billingAddress?: string; // Dirección
  phone?: string; // Teléfono
  logoUrl?: string; // URL del logo (para futuro)
}

export const fetchUserCompany = async (
  userId: string,
  token: string,
): Promise<Company | null> => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COMPANY}/company/user/${userId}`,
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
    };
  } catch (error) {
    // Es normal que falle si el usuario es personal operativo (no es el dueño registrado en ms-company)
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
    };
  } catch (error) {
    console.error("Error al obtener company by id:", error);
    return null;
  }
};

export const getAllCompanies = async (token: string): Promise<Company[]> => {
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_API_COMPANY}/company`,
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
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
};
