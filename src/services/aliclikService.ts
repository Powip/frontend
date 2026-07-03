import axios from "axios";

const API_INTEGRATIONS = (
  process.env.NEXT_PUBLIC_API_INTEGRATIONS || "http://localhost:3004"
).replace(/\/$/, "");

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

// ─── TIPOS ──────────────────────────────────────────────

export interface AliclikCredentialSafe {
  id: string;
  companyId: string;
  baseUrl: string | null;
  isActive: boolean;
  webhookSecret: string | null;
  importStoreId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAliclikCredentialPayload {
  companyId: string;
  token: string;
  baseUrl?: string;
}

export interface AliclikConnectionTestResult {
  ok: boolean;
  message?: string;
}

export interface AliclikCourierOption {
  id: number;
  transportId: number;
  transportName: string;
  transportUrlImage: string;
  addDays: number;
  deliveryCost: number;
  returnCost: number;
  flagDeliveryExpress: boolean;
  schedule: string | null;
  scheduleExpressStart: string | null;
  scheduleExpressEnd: string | null;
}

export interface AliclikWarehouseItem {
  sku: string;
  ean: string;
  quantity: number;
  unitPrice: number;
  productName: string;
}

export interface AliclikWarehouseUbigeo {
  department: string;
  province: string;
  district: string;
}

export interface AliclikWarehouseQuote {
  warehouseId: number;
  warehouseName: string;
  items: AliclikWarehouseItem[];
  ubigeo: AliclikWarehouseUbigeo | null;
  couriers: AliclikCourierOption[];
}

export interface AliclikCustomer {
  lat: number | null;
  lng: number | null;
  fullName: string;
  province: string;
  city: string;
  district: string;
}

export interface AliclikUnresolvedItem {
  sku: string;
  productName: string;
}

export interface AliclikOrderQuote {
  orderId: string;
  orderNumber: string;
  companyId: string;
  shippingTotalSugerido: number;
  customer: AliclikCustomer;
  warehouses: AliclikWarehouseQuote[];
  unresolvedItems: AliclikUnresolvedItem[];
}

export interface AliclikShipmentPayload {
  warehouseId: number;
  delivery: number;
  courier: {
    transportId: number;
    deliveryCost: number;
    returnCost: number;
    addDays: number;
    flagDeliveryExpress: boolean;
    schedule: string | null;
    scheduleExpressStart: string | null;
    scheduleExpressEnd: string | null;
  };
}

export interface AliclikCreateOrderPayload {
  companyId: string;
  orderId: string;
  channel?: string;
  note?: string;
  shipments: AliclikShipmentPayload[];
}

export interface AliclikShipmentResult {
  warehouseId: number;
  externalOrderNumber: string;
}

export interface AliclikCreateOrderResult {
  shipments: AliclikShipmentResult[];
}

export type AliclikCancelResult = "cancelled" | "cancel_pending" | "rejected";

export interface AliclikCancelWarehouseResult {
  warehouseId: number;
  externalOrderNumber: string | null;
  result: AliclikCancelResult;
  reason?: string;
}

export interface AliclikCancelOrderResult {
  results: AliclikCancelWarehouseResult[];
}

// ─── SERVICIOS ──────────────────────────────────────────

export const getAliclikCredentials = async (
  token: string,
  companyId: string,
): Promise<AliclikCredentialSafe | null> => {
  try {
    const res = await axios.get<AliclikCredentialSafe>(
      `${API_INTEGRATIONS}/aliclik/credentials/${companyId}`,
      { headers: headers(token) },
    );
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
};

export const saveAliclikCredentials = async (
  token: string,
  payload: SaveAliclikCredentialPayload,
): Promise<AliclikCredentialSafe> => {
  const res = await axios.post<AliclikCredentialSafe>(
    `${API_INTEGRATIONS}/aliclik/credentials`,
    payload,
    { headers: headers(token) },
  );
  return res.data;
};

export const testAliclikConnection = async (
  token: string,
  companyId: string,
): Promise<AliclikConnectionTestResult> => {
  const res = await axios.get<AliclikConnectionTestResult>(
    `${API_INTEGRATIONS}/aliclik/connection-test/${companyId}`,
    { headers: headers(token) },
  );
  return res.data;
};

export const quoteAliclikOrder = async (
  token: string,
  companyId: string,
  orderId: string,
): Promise<AliclikOrderQuote> => {
  const res = await axios.get(
    `${API_INTEGRATIONS}/aliclik/${companyId}/orders/${orderId}/quote`,
    { headers: headers(token) },
  );
  return res.data;
};

export const createAliclikOrder = async (
  token: string,
  payload: AliclikCreateOrderPayload,
): Promise<AliclikCreateOrderResult> => {
  const res = await axios.post(
    `${API_INTEGRATIONS}/aliclik/orders`,
    payload,
    { headers: headers(token) },
  );
  return res.data;
};

export const cancelAliclikOrder = async (
  token: string,
  orderId: string,
  companyId: string,
): Promise<AliclikCancelOrderResult> => {
  const res = await axios.post<AliclikCancelOrderResult>(
    `${API_INTEGRATIONS}/aliclik/orders/cancel`,
    { companyId, orderId },
    { headers: headers(token) },
  );
  return res.data;
};

export const updateAliclikStore = async (
  token: string,
  companyId: string,
  storeId: string | null,
): Promise<AliclikCredentialSafe> => {
  const res = await axios.patch<AliclikCredentialSafe>(
    `${API_INTEGRATIONS}/aliclik/credentials/${companyId}/store`,
    { storeId },
    { headers: headers(token) },
  );
  return res.data;
};
