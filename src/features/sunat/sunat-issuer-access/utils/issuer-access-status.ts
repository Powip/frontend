import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";
import type { SunatDocument } from "../../sunat-document/models/sunat-document.model";
import type { TaxDocumentRow } from "../../sunat-document/types/tax-document-row";
import type { SunatIssuerAccessBlock } from "../models/sunat-issuer-access-block";
import { isIssuerAccessCode } from "./issuer-access-errors";

/** The block that is keeping this document from being sent, if any. */
export function findBlockForDocument(
  blocks: SunatIssuerAccessBlock[],
  taxDocument: SunatDocument | undefined,
): SunatIssuerAccessBlock | undefined {
  if (!taxDocument) {
    return undefined;
  }

  return blocks.find(
    (block) =>
      block.rucIssuer === taxDocument.rucIssuer &&
      block.taxDocumentType === taxDocument.taxDocumentType,
  );
}

/**
 * How a document relates to "SUNAT refused the issuer":
 * - WAITING: unsent, keeps its number, goes out once the block is released.
 * - FAILED: an older document that already failed for this reason (before
 *   documents were held). Its number is spent; it must be issued again.
 */
export type IssuerAccessState = "WAITING" | "FAILED" | null;

export function getIssuerAccessState(
  blocks: SunatIssuerAccessBlock[],
  taxDocument: SunatDocument | undefined,
): IssuerAccessState {
  if (!taxDocument) {
    return null;
  }

  if (taxDocument.cdrStatus === "PENDING") {
    return findBlockForDocument(blocks, taxDocument) ? "WAITING" : null;
  }

  if (taxDocument.cdrStatus === "RETRY_EXCEEDED" && isIssuerAccessCode(taxDocument.sunatCode)) {
    return "FAILED";
  }

  return null;
}

/**
 * Document types of the same RUC that SUNAT IS accepting, with the latest
 * accepted number as evidence. This is what lets the screen say "your sales
 * receipts are accepted, your invoices are not".
 */
export function findAcceptedTypesOfIssuer(
  rows: TaxDocumentRow[],
  block: SunatIssuerAccessBlock,
): { taxDocumentType: SunatDocumentType; lastNumber: string }[] {
  const latestByType = new Map<SunatDocumentType, SunatDocument>();

  for (const { taxDocument } of rows) {
    if (
      !taxDocument ||
      taxDocument.rucIssuer !== block.rucIssuer ||
      taxDocument.taxDocumentType === block.taxDocumentType ||
      (taxDocument.cdrStatus !== "ACCEPTED" &&
        taxDocument.cdrStatus !== "ACCEPTED_WITH_OBSERVATION")
    ) {
      continue;
    }

    const current = latestByType.get(taxDocument.taxDocumentType);

    if (!current || new Date(taxDocument.createdAt) > new Date(current.createdAt)) {
      latestByType.set(taxDocument.taxDocumentType, taxDocument);
    }
  }

  return [...latestByType.entries()].map(([taxDocumentType, document]) => ({
    taxDocumentType,
    lastNumber: `${document.series}-${document.correlative}`,
  }));
}
