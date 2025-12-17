import { Client } from "@/interfaces/ICliente";

const API_URL = "http://localhost:3002";

export async function fetchClientByPhone(
  companyId: string,
  phone: string
): Promise<Client | null> {
  const res = await fetch(
    `${API_URL}/clients/company/${companyId}/phone/${phone}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error("Error fetching client");
  }

  const data = await res.json();

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
}) {
  const res = await fetch("http://localhost:3002/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Error creating client");
  }

  return res.json();
}
