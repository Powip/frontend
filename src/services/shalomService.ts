import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_INTEGRATIONS = GATEWAY.integrations;
const API_COURIER = GATEWAY.courier;

// ─── TIPOS ──────────────────────────────────────────────

export interface ShalomConfig {
  id: string;
  companyId: string;
  instanceId: string | null;
  instanceKey: string | null;
  username: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShalomAgency {
  id: number | string;
  name: string;
  province?: string;
  department?: string;
  zone?: string;
  abbreviation?: string;
  lugar?: string;
  lugar_over?: string;
  telefono?: string;
  hora_atencion?: string;
  hora_domingo?: string;
  detalles?: string;
  ter_categoria_envia?: string;
  ter_categoria_recibe?: string;
}

// ─── CONEXIÓN GLOBAL ─────────────────────────────────────

/** Verifica que el servidor Shalom responde (sin empresa, admin key global) */
export const testShalomConnection = async (): Promise<{ ok: boolean; agenciesCount: number }> => {
  const res = await axiosAuth.get(`${API_INTEGRATIONS}/shalom/connection-test`);
  return res.data;
};

// ─── CONFIG POR EMPRESA ──────────────────────────────────

/** Solo guarda usuario + contraseña Shalom Pro */
export const saveShalomConfig = async (
  data: { companyId: string; username: string; password: string },
): Promise<ShalomConfig> => {
  const res = await axiosAuth.post(`${API_INTEGRATIONS}/shalom/config`, data);
  return res.data;
};

/** Retorna la config de la empresa (sin contraseña) */
export const getShalomConfig = async (
  companyId: string,
): Promise<ShalomConfig | null> => {
  try {
    const res = await axiosAuth.get(
      `${API_INTEGRATIONS}/shalom/config/${companyId}`,
    );
    return res.data;
  } catch {
    return null;
  }
};

// ─── INSTANCIA Y SESIÓN ──────────────────────────────────

export const createShalomInstance = async (
  companyId: string,
): Promise<{ instanceId: string }> => {
  const res = await axiosAuth.post(
    `${API_INTEGRATIONS}/shalom/instance/${companyId}`,
    {},
  );
  return res.data;
};

export const loginShalom = async (
  companyId: string,
): Promise<{ success: boolean; message: string }> => {
  const res = await axiosAuth.post(
    `${API_INTEGRATIONS}/shalom/login`,
    { companyId },
  );
  return res.data;
};

export const getShalomStatus = async (
  companyId: string,
): Promise<{
  isLoggedIn: boolean;
  username: string | null;
  hasInstance: boolean;
}> => {
  const res = await axiosAuth.get(
    `${API_INTEGRATIONS}/shalom/status/${companyId}`,
  );
  return res.data;
};

// ─── AGENCIAS (global, sin companyId) ────────────────────

export const listShalomAgencies = async (
  q?: string,
): Promise<ShalomAgency[]> => {
  const url = q
    ? `${API_INTEGRATIONS}/shalom/agencies/search/${encodeURIComponent(q)}`
    : `${API_INTEGRATIONS}/shalom/agencies`;

  try {
    const res = await axiosAuth.get(url);
    const data = res.data;

    let rawAgencies: any[] = [];
    if (Array.isArray(data)) rawAgencies = data;
    else if (data && Array.isArray(data.data)) rawAgencies = data.data;
    else if (data && Array.isArray(data.agencies)) rawAgencies = data.agencies;

    return rawAgencies.map((ag: any) => ({
      ...ag,
      id: ag.ter_id ?? ag.id,
      name: ag.nombre ?? ag.name,
      abbreviation: ag.ter_abrebiatura ?? ag.abbreviation,
      province: ag.provincia ?? ag.province,
      department: ag.departamento ?? ag.department,
      zone: ag.zona ?? ag.zone,
    }));
  } catch (error) {
    return [];
  }
};

// ─── TRACKING ────────────────────────────────────────────

export const trackShalomShipment = async (
  companyId: string, // ⬅️ SÍ es necesario
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
): Promise<Record<string, unknown>> => {
  const res = await axiosAuth.post(
    `${API_INTEGRATIONS}/shalom/track`,
    {
      companyId, // ✅ Enviar companyId
      orderNumber: externalTrackingNumber,
      orderCode: shippingCode,
    },
  );
  return res.data;
};

/** Rastrear usando el proxy de ms-courier que conoce la guía */
export const trackShalomGuide = async (
  guideId: string,
): Promise<Record<string, unknown>> => {
  const res = await axiosAuth.get(
    `${API_COURIER}/shipping-guides/${guideId}/shalom/track`,
  );
  return res.data;
};

// ─── DOCUMENTOS ──────────────────────────────────────────

export const getShalomTicketPdfUrl = (
  orderNumber: string,
  orderCode: string,
): string =>
  `${API_INTEGRATIONS}/shalom/ticket-pdf/${orderNumber}/${orderCode}`;

export const generateShalomTicketPdf = async (
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
): Promise<Blob> => {
  // ✅ CAMBIO: GET con parámetros de ruta en lugar de POST con body
  const res = await axiosAuth.get(
    `${API_INTEGRATIONS}/shalom/ticket-pdf/${externalTrackingNumber}/${shippingCode}`,
    { responseType: "blob" },
  );
  return res.data;
};

export const getShalomLabelPdfUrl = (
  orderNumber: string,
  orderCode: string,
): string => `${API_INTEGRATIONS}/shalom/label/${orderNumber}/${orderCode}`;

/** Cotizar un envío individual */
export const quoteShalom = async (
  data: {
    origin: string;
    destination: string;
    content: string;
    height: number;
    width: number;
    length: number;
    weight: number;
    quantity: number;
  },
): Promise<{
  precio: number;
  moneda: string;
  status: string;
  message?: string;
}> => {
  const res = await axiosAuth.post(
    `${API_COURIER}/shipping-guides/shalom/quote`,
    data,
  );
  return res.data;
};

/** Actualizar la cotización de una guía en la DB */
export const updateGuideQuote = async (
  guideId: string,
  quotedAmount: number,
  quotedCurrency: string = "PEN",
): Promise<void> => {
  await axiosAuth.patch(
    `${API_COURIER}/shipping-guides/${guideId}/quote`,
    { quotedAmount, quotedCurrency },
  );
};

// ─── ENVÍO DESDE GUÍA ────────────────────────────────────

export const sendGuideToShalom = async (
  guideId: string,
  data: {
    companyId: string;
    orderDestinations: Record<string, string>; // {orderId: agencyId}
    orderDestinationNames: Record<string, string>; // {orderId: agencyName}
    originAgencyId: string;
    originAgencyName: string;
    packageDetails: Record<
      string,
      {
        weight: number;
        height: number;
        width: number;
        length: number;
        content: string;
        recipientDoc: string;
        recipientPhone: string;
      }
    >;
    securityCode?: string;
    quotedAmount?: number;
    quotedCurrency?: string;
  },
): Promise<{
  success: boolean;
  trackingData: Record<
    string,
    { orderNumber: string; orderCode: string }
  > | null;
}> => {
  const res = await axiosAuth.post(
    `${API_COURIER}/shipping-guides/${guideId}/send-to-shalom`,
    data,
  );
  return res.data;
};
