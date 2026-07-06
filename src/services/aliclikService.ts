import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_INTEGRATIONS = GATEWAY.integrations;

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
  _token: string,
  companyId: string,
): Promise<AliclikCredentialSafe | null> => {
  try {
    const res = await axiosAuth.get<AliclikCredentialSafe>(
      `${API_INTEGRATIONS}/aliclik/credentials/${companyId}`,
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
  _token: string,
  payload: SaveAliclikCredentialPayload,
): Promise<AliclikCredentialSafe> => {
  const res = await axiosAuth.post<AliclikCredentialSafe>(
    `${API_INTEGRATIONS}/aliclik/credentials`,
    payload,
  );
  return res.data;
};

export const testAliclikConnection = async (
  _token: string,
  companyId: string,
): Promise<AliclikConnectionTestResult> => {
  const res = await axiosAuth.get<AliclikConnectionTestResult>(
    `${API_INTEGRATIONS}/aliclik/connection-test/${companyId}`,
  );
  return res.data;
};

export const quoteAliclikOrder = async (
  _token: string,
  companyId: string,
  orderId: string,
): Promise<AliclikOrderQuote> => {
  const res = await axiosAuth.get(
    `${API_INTEGRATIONS}/aliclik/${companyId}/orders/${orderId}/quote`,
  );
  return res.data;
};

export const createAliclikOrder = async (
  _token: string,
  payload: AliclikCreateOrderPayload,
): Promise<AliclikCreateOrderResult> => {
  const res = await axiosAuth.post(
    `${API_INTEGRATIONS}/aliclik/orders`,
    payload,
  );
  return res.data;
};

export const cancelAliclikOrder = async (
  orderId: string,
  companyId: string,
): Promise<AliclikCancelOrderResult> => {
  const res = await axiosAuth.post<AliclikCancelOrderResult>(
    `${API_INTEGRATIONS}/aliclik/orders/cancel`,
    { companyId, orderId },
  );
  return res.data;
};

export const updateAliclikStore = async (
  companyId: string,
  storeId: string | null,
): Promise<AliclikCredentialSafe> => {
  const res = await axiosAuth.patch<AliclikCredentialSafe>(
    `${API_INTEGRATIONS}/aliclik/credentials/${companyId}/store`,
    { storeId },
  );
  return res.data;
};
