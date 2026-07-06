import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

export interface IManualInvoicePayload {
  externalId: string;
  documentType: "01" | "03";
  customerName: string;
  customerDocType: "1" | "6" | "7";
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

export const generateManualInvoice = async (payload: IManualInvoicePayload) => {
  const { data } = await axiosAuth.post(`${GATEWAY.integrations}/sunat/generate-manual`, payload);
  return data;
};

export const getInvoiceLogByExternalId = async (externalId: string) => {
  try {
    const { data } = await axiosAuth.get(`${GATEWAY.integrations}/sunat/logs/external/${externalId}`);
    return data;
  } catch {
    return { success: false, message: "Error al consultar el comprobante" };
  }
};
