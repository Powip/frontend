import type { Order } from "@/features/sales/models/order";
import type { OrderStatus } from "@/features/sales/types/order.types";
import type { SunatDocument } from "../../sunat-document/models/sunat-document.model";

export const IGV_RATE = 0.18;

/**
 * Order statuses from which a tax document (boleta/factura) can be emitted: the guide is
 * approved (`EN_ENVIO`) or the sale is delivered (`ENTREGADO`). Any other status is kept out of
 * the billing list. The Guía de Remisión is a separate flow and does not use this list.
 */
export const TAX_DOCUMENT_ELIGIBLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "EN_ENVIO",
  "ENTREGADO",
];

export const isTaxDocumentEligibleStatus = (status: OrderStatus): boolean =>
  TAX_DOCUMENT_ELIGIBLE_ORDER_STATUSES.includes(status);

// Stable references so an undefined React Query `data` value does not
// create a new array on every render.
export const EMPTY_SALES: Order[] = [];
export const EMPTY_DOCUMENTS: SunatDocument[] = [];
