import axios from "axios";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");
const API_COURIER = (
  process.env.NEXT_PUBLIC_API_COURIER || "http://localhost:3003"
).replace(/\/$/, "");

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

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
export const testShalomConnection = async (
  token: string,
): Promise<{ ok: boolean; agenciesCount: number }> => {
  const res = await axios.get(`${API_INTEGRATIONS}/shalom/connection-test`, {
    headers: headers(token),
  });
  return res.data;
};

// ─── CONFIG POR EMPRESA ──────────────────────────────────

/** Solo guarda usuario + contraseña Shalom Pro */
export const saveShalomConfig = async (
  token: string,
  data: { companyId: string; username: string; password: string },
): Promise<ShalomConfig> => {
  const res = await axios.post(`${API_INTEGRATIONS}/shalom/config`, data, {
    headers: headers(token),
  });
  return res.data;
};

/** Retorna la config de la empresa (sin contraseña) */
export const getShalomConfig = async (
  token: string,
  companyId: string,
): Promise<ShalomConfig | null> => {
  try {
    const res = await axios.get(
      `${API_INTEGRATIONS}/shalom/config/${companyId}`,
      { headers: headers(token) },
    );
    return res.data;
  } catch {
    return null;
  }
};

// ─── INSTANCIA Y SESIÓN ──────────────────────────────────

export const createShalomInstance = async (
  token: string,
  companyId: string,
): Promise<{ instanceId: string }> => {
  const res = await axios.post(
    `${API_INTEGRATIONS}/shalom/instance/${companyId}`,
    {},
    { headers: headers(token) },
  );
  return res.data;
};

export const loginShalom = async (
  token: string,
  companyId: string,
): Promise<{ success: boolean; message: string }> => {
  const res = await axios.post(
    `${API_INTEGRATIONS}/shalom/login`,
    { companyId },
    { headers: headers(token) },
  );
  return res.data;
};

export const getShalomStatus = async (
  token: string,
  companyId: string,
): Promise<{
  isLoggedIn: boolean;
  username: string | null;
  hasInstance: boolean;
}> => {
  const res = await axios.get(
    `${API_INTEGRATIONS}/shalom/status/${companyId}`,
    { headers: headers(token) },
  );
  return res.data;
};

// ─── AGENCIAS (global, sin companyId) ────────────────────

export const listShalomAgencies = async (
  token: string,
  q?: string,
): Promise<ShalomAgency[]> => {
  const url = q
    ? `${API_INTEGRATIONS}/shalom/agencies/search/${encodeURIComponent(q)}`
    : `${API_INTEGRATIONS}/shalom/agencies`;

  try {
    const res = await axios.get(url, { headers: headers(token) });
    const data = res.data;

    console.log("SHALOM API RAW RESPONSE:", data);

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
    console.error("SHALOM API ERROR:", error);
    return [];
  }
};

// ─── TRACKING ────────────────────────────────────────────

export const trackShalomShipment = async (
  token: string,
  companyId: string, // ⬅️ SÍ es necesario
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
): Promise<Record<string, unknown>> => {
  const res = await axios.post(
    `${API_INTEGRATIONS}/shalom/track`,
    {
      companyId, // ✅ Enviar companyId
      orderNumber: externalTrackingNumber,
      orderCode: shippingCode,
    },
    { headers: headers(token) },
  );
  return res.data;
};

/** Rastrear usando el proxy de ms-courier que conoce la guía */
export const trackShalomGuide = async (
  token: string,
  guideId: string,
): Promise<Record<string, unknown>> => {
  const res = await axios.get(
    `${API_COURIER}/shipping-guides/${guideId}/shalom/track`,
    { headers: headers(token) },
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
  token: string,
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
): Promise<Blob> => {
  // ✅ CAMBIO: GET con parámetros de ruta en lugar de POST con body
  const res = await axios.get(
    `${API_INTEGRATIONS}/shalom/ticket-pdf/${externalTrackingNumber}/${shippingCode}`,
    {
      headers: headers(token),
      responseType: "blob",
    },
  );
  return res.data;
};

export const getShalomLabelPdfUrl = (
  orderNumber: string,
  orderCode: string,
): string => `${API_INTEGRATIONS}/shalom/label/${orderNumber}/${orderCode}`;

/** Cotizar un envío individual */
export const quoteShalom = async (
  token: string,
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
  const res = await axios.post(
    `${API_COURIER}/shipping-guides/shalom/quote`,
    data,
    { headers: headers(token) },
  );
  return res.data;
};

/** Actualizar la cotización de una guía en la DB */
export const updateGuideQuote = async (
  token: string,
  guideId: string,
  quotedAmount: number,
  quotedCurrency: string = "PEN",
): Promise<void> => {
  await axios.patch(
    `${API_COURIER}/shipping-guides/${guideId}/quote`,
    { quotedAmount, quotedCurrency },
    { headers: headers(token) },
  );
};

// ─── ENVÍO DESDE GUÍA ────────────────────────────────────

export const sendGuideToShalom = async (
  token: string,
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
  const res = await axios.post(
    `${API_COURIER}/shipping-guides/${guideId}/send-to-shalom`,
    data,
    { headers: headers(token) },
  );
  return res.data;
};
