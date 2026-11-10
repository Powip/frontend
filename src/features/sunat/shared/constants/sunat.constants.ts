import type { Order } from "@/features/sales/models/order";
import type { OrderStatus } from "@/features/sales/types/order.types";
import type { SunatDocument } from "../../sunat-document/models/sunat-document.model";

export const IGV_RATE = 0.18;

/**
 * Order statuses from which a tax document (boleta/factura) can be emitted: from the moment the
 * order is prepared onwards, i.e. once it physically exists and is on its way to the customer.
 * Never while it is still being sold (`INCOMPLETE`, `PREVENTA`, `PENDIENTE`, `PAGADO`) nor once it
 * is `ANULADO`. The Guía de Remisión is a separate flow and does not use this list.
 *
 * This is the single source of the rule: the billing list, its copy and any tooltip read it from here.
 */
export const TAX_DOCUMENT_ELIGIBLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
  "EN_ENVIO",
  "DESPACHADO",
  "ENTREGADO",
];

export const isTaxDocumentEligibleStatus = (status: OrderStatus): boolean =>
  TAX_DOCUMENT_ELIGIBLE_ORDER_STATUSES.includes(status);

// Stable references so an undefined React Query `data` value does not
// create a new array on every render.
export const EMPTY_SALES: Order[] = [];
export const EMPTY_DOCUMENTS: SunatDocument[] = [];
