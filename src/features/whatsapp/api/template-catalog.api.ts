import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";

const BASE = `${API.integrations}/wa`;

export interface WhatsAppTemplateCatalogVariable {
  key: string;
  label: string;
  sample: string;
}

/** C-14: pedido real con los valores que tomarían las variables. `null` = dato faltante. */
export interface WhatsAppTemplateSampleOrder {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  status: string | null;
  values: Record<string, string | null>;
}

/** C-13: variables que el motor de avisos sabe rellenar. */
export async function getWhatsAppTemplateCatalog(): Promise<WhatsAppTemplateCatalogVariable[]> {
  assertWhatsAppContractAvailable("templateCatalog");
  const { data } = await axiosAuth.get<{ variables: WhatsAppTemplateCatalogVariable[] }>(
    `${BASE}/template-catalog`,
  );
  return data?.variables ?? [];
}

/** C-14: pedidos recientes de la tienda para previsualizar la plantilla con datos reales. */
export async function listWhatsAppTemplateSampleOrders(
  storeId: string | null,
  limit = 10,
): Promise<WhatsAppTemplateSampleOrder[]> {
  assertWhatsAppContractAvailable("templateCatalog");
  const { data } = await axiosAuth.get<{ items: WhatsAppTemplateSampleOrder[] }>(
    `${BASE}/preview-orders`,
    { params: { storeId: storeId ?? undefined, limit } },
  );
  return data?.items ?? [];
}
