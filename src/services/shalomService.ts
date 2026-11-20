import axiosAuth from "@/lib/axiosAuth";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");
const API_COURIER = (
  process.env.NEXT_PUBLIC_API_COURIER || "http://localhost:3003"
).replace(/\/$/, "");

// FEAT-24 SEC (sec6a): ms-integrations cierra /shalom/* a la sesión (la empresa sale del token; otra empresa →
// 404). Todo va con `axiosAuth`, que agrega el Bearer de la sesión si no viene uno y lo renueva ante un 401. Los PDF
// (comprobante y rótulo) se piden como blob y se abren con un object URL: nunca un enlace directo a
// `/shalom/ticket-pdf` o `/shalom/label`, que no puede llevar el header.
const headers = (token?: string): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

// ─── TIPOS ──────────────────────────────────────────────

export interface ShalomConfig {
  id: string;
  companyId: string;
  instanceId: string | null;
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
  const res = await axiosAuth.get(`${API_INTEGRATIONS}/shalom/connection-test`, {
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
  const res = await axiosAuth.post(`${API_INTEGRATIONS}/shalom/config`, data, {
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
    const res = await axiosAuth.get(
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
  const res = await axiosAuth.post(
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
  const res = await axiosAuth.post(
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
  const res = await axiosAuth.get(
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
    const res = await axiosAuth.get(url, { headers: headers(token) });
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

/** Metadatos de frescura que suma el backend (opcionales: un backend viejo no los manda). */
export interface ShalomSyncMeta {
  /** ISO: cuándo se consultó a Shalom por última vez. */
  syncedAt?: string;
  /** true si la respuesta salió de lo guardado y no de una consulta nueva a Shalom. */
  fromCache?: boolean;
}

/** Respuesta de `POST /shalom/track` (forma libre de Shalom + metadatos de frescura). */
export type ShalomTrackResponse = Record<string, unknown> & ShalomSyncMeta;

export interface TrackShalomShipmentOptions {
  /** Fuerza una consulta a Shalom (el backend la limita a una cada 2 min por guía). */
  refresh?: boolean;
}

export const trackShalomShipment = async (
  token: string,
  companyId: string, // ⬅️ SÍ es necesario
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
  options: TrackShalomShipmentOptions = {},
): Promise<ShalomTrackResponse> => {
  const res = await axiosAuth.post(
    `${API_INTEGRATIONS}/shalom/track`,
    {
      companyId, // ✅ Enviar companyId
      orderNumber: externalTrackingNumber,
      orderCode: shippingCode,
      ...(options.refresh ? { refresh: true } : {}),
    },
    { headers: headers(token) },
  );
  return res.data;
};

/** Orden a rastrear en el lote (8 dígitos + 4 caracteres de Shalom). */
export interface ShalomMassiveTrackOrder {
  orderNumber: string;
  orderCode: string;
}

/** Ítem del array plano que devuelve `POST /shalom/track-massive`. */
export interface ShalomMassiveTrackResult extends ShalomSyncMeta {
  orderNumber: string;
  orderCode: string;
  search?: { success: boolean; message: string };
  statuses?: {
    /** Forma resumida que devuelve `POST /track/batch`. */
    estado?: string;
    status?: string;
    /** Forma detallada que devuelve `POST /track`. */
    data?: Record<string, unknown>;
  } | null;
}

/**
 * Rastreo masivo de envíos Shalom — hasta 50 órdenes por request.
 * NO requiere companyId (usa la Admin Key global del servidor Shalom).
 * La respuesta es un array plano; cada ítem puede traer el resumen
 * `statuses.estado` o la línea de tiempo `statuses.data`.
 * Evita disparar N `POST /shalom/track` sueltos en paralelo (429 del proveedor
 * que también tira abajo cotización y agencias por compartir la API key global).
 */
export const trackShalomMassive = async (
  token: string,
  orders: ShalomMassiveTrackOrder[],
): Promise<ShalomMassiveTrackResult[]> => {
  const res = await axiosAuth.post(
    `${API_INTEGRATIONS}/shalom/track-massive`,
    { orders },
    { headers: headers(token) },
  );
  return Array.isArray(res.data) ? res.data : [];
};

/** Rastrear usando el proxy de ms-courier que conoce la guía */
export const trackShalomGuide = async (
  token: string,
  guideId: string,
): Promise<Record<string, unknown>> => {
  const res = await axiosAuth.get(
    `${API_COURIER}/shipping-guides/${guideId}/shalom/track`,
    { headers: headers(token) },
  );
  return res.data;
};

// ─── DOCUMENTOS ──────────────────────────────────────────

export const generateShalomTicketPdf = async (
  token: string,
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
  companyId: string,
): Promise<Blob> => {
  const res = await axiosAuth.get(
    `${API_INTEGRATIONS}/shalom/ticket-pdf/${encodeURIComponent(externalTrackingNumber)}/${encodeURIComponent(shippingCode)}`,
    {
      headers: headers(token),
      params: { companyId },
      responseType: "blob",
    },
  );
  return res.data;
};

export const generateShalomLabelPdf = async (
  token: string,
  externalTrackingNumber: string, // ⬅️ 8 dígitos de Shalom
  shippingCode: string, // ⬅️ 4 caracteres de Shalom
  companyId: string,
): Promise<Blob> => {
  const res = await axiosAuth.get(
    `${API_INTEGRATIONS}/shalom/label/${encodeURIComponent(externalTrackingNumber)}/${encodeURIComponent(shippingCode)}`,
    {
      headers: headers(token),
      params: { companyId },
      responseType: "blob",
    },
  );
  return res.data;
};

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
  const res = await axiosAuth.post(
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
  await axiosAuth.patch(
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
  const res = await axiosAuth.post(
    `${API_COURIER}/shipping-guides/${guideId}/send-to-shalom`,
    data,
    { headers: headers(token) },
  );
  return res.data;
};
