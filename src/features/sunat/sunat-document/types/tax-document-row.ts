import type { Order } from "@/features/sales/models/order";
import type { SunatDocument } from "../models/sunat-document.model";

export interface TaxDocumentRow {
  sale: Order;
  /**
   * The latest SUNAT document associated with this sale, if one exists.
   *
   * `undefined` means the sale has not been emitted to SUNAT yet.
   */
  taxDocument?: SunatDocument;
}
