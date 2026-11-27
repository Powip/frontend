import type { SunatDocument } from "../models/sunat-document.model";

const ACTIVE_STATUSES: readonly string[] = ["PENDING", "ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];

/**
 * A document still counts (as a factura in force or as a nota that reduces the balance) when SUNAT
 * accepted it or is processing it, and it was not dado de baja. A baja in process or rejected still
 * counts: only SUNAT's acceptance of the comunicación de baja removes it.
 *
 * Same rule as ms-sunat-tax-documents (src/domain/sunat-document/find-active-document-for-order.ts,
 * countsAsIssued). Keep both in sync.
 */
export function countsAsIssued(document: Pick<SunatDocument, "cdrStatus" | "voidStatus">): boolean {
  return ACTIVE_STATUSES.includes(document.cdrStatus) && document.voidStatus !== "VOIDED";
}
