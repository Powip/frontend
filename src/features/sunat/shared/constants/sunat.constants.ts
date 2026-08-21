import type { Order } from "@/models/sales/order";
import type { SunatDocument } from "../../sunat-document/models/sunat-document.model";

export const IGV_RATE = 0.18;

// Stable references so an undefined React Query `data` value does not
// create a new array on every render.
export const EMPTY_SALES: Order[] = [];
export const EMPTY_DOCUMENTS: SunatDocument[] = [];
