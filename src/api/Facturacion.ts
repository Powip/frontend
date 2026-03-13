import { API } from "@/lib/api";
import axios from "axios";

/**
 * Payload para generar un comprobante SUNAT de forma manual.
 */
export interface IManualInvoicePayload {
  externalId: string;
  documentType: "01" | "03"; // "01" Factura, "03" Boleta
  customerName: string;
  customerDocType: "1" | "6" | "7"; // "1" DNI, "6" RUC, "7" Pasaporte
  customerDocNumber: string;
  customerAddress?: string;
  currency?: string;
  totalTax: number;
  totalValue: number;
  totalPrice: number;
  items: {
    internalCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    unitCode: string;
    taxType: string;
  }[];
}

/**
 * Genera un comprobante SUNAT llamando al microservicio de integraciones.
 */
export const generateManualInvoice = async (payload: IManualInvoicePayload) => {
  const { data } = await axios.post(`${API.integrations}/sunat/generate-manual`, payload);
  return data;
};

/**
 * Obtiene el log de facturación de una venta específica por su externalId.
 */
export const getInvoiceLogByExternalId = async (externalId: string) => {
  try {
    const { data } = await axios.get(`${API.integrations}/sunat/logs/external/${externalId}`);
    return data;
  } catch (error) {
    console.error("Error fetching invoice log:", error);
    return { success: false, message: "Error al consultar el comprobante" };
  }
};
