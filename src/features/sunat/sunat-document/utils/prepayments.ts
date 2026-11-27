import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import {
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  type SunatTaxAffectationType,
  UNIT_CODES,
} from "../enums/sunat-document.enums";
import type { SunatDocument, SunatDocumentItem } from "../models/sunat-document.model";
import type { CreateSunatDocumentsFormValues } from "../schemas/create-sunat-documents.schema";
import { countsAsIssued } from "./counts-as-issued";
import { isGiftTaxType } from "./gift-lines";

/**
 * Anticipos (advance payments), Anexo 9-A of RS 114-2019/SUNAT. Same rules
 * as ms-sunat-tax-documents (src/domain/sunat-document/prepayment-rules.ts
 * and find-active-document-for-order.ts).
 */

const ACCEPTED_STATUSES: readonly string[] = ["ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];
const CENT = 0.01;

type FormDocument = CreateSunatDocumentsFormValues["documents"][number];

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const grandTotalOf = (document: SunatDocument): number =>
  Number(document.taxDocumentPayload?.totals?.grandTotal) || 0;

export function isPrepaymentDocument(document: SunatDocument): boolean {
  return document.taxDocumentPayload?.isPrepayment === true;
}

function isInvoiceOrReceipt(document: SunatDocument): boolean {
  return (
    document.taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE ||
    document.taxDocumentType === SUNAT_DOCUMENT_TYPES.SALES_RECEIPT
  );
}

function creditNotesOf(document: SunatDocument, documents: readonly SunatDocument[]) {
  return documents.filter(
    (note) =>
      note.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE &&
      countsAsIssued(note) &&
      note.referenceDocumentId === document.id,
  );
}

/**
 * Factura/boleta in a live status that credit notes did not cancel in full.
 * A final document fully paid by anticipos has a total of 0: it stays in
 * force until a credit note references it.
 */
export function isDocumentInForce(
  document: SunatDocument,
  documents: readonly SunatDocument[],
): boolean {
  if (!isInvoiceOrReceipt(document) || !countsAsIssued(document)) {
    return false;
  }

  const notes = creditNotesOf(document, documents);
  const total = grandTotalOf(document);

  if ((document.taxDocumentPayload?.prepayments?.length ?? 0) > 0 && total < CENT) {
    return notes.length === 0;
  }

  const credited = notes.reduce((sum, note) => sum + grandTotalOf(note), 0);
  return credited + CENT < total;
}

function isDeductedByFinal(anticipo: SunatDocument, documents: readonly SunatDocument[]): boolean {
  return documents.some(
    (document) =>
      document.taxDocumentPayload?.prepayments?.some(
        (prepayment) => prepayment.documentId === anticipo.id,
      ) && isDocumentInForce(document, documents),
  );
}

/** Anticipos of the order still to deduct (sent or accepted, not credited, not deducted). */
export function findOpenPrepayments(orderDocuments: readonly SunatDocument[]): SunatDocument[] {
  return orderDocuments.filter(
    (document) =>
      isPrepaymentDocument(document) &&
      countsAsIssued(document) &&
      creditNotesOf(document, orderDocuments).length === 0 &&
      !isDeductedByFinal(document, orderDocuments),
  );
}

/** Open anticipos SUNAT already accepted: the final document can deduct them. */
export function isPrepaymentReady(document: SunatDocument): boolean {
  return ACCEPTED_STATUSES.includes(document.cdrStatus);
}

/** Single affectation an anticipo can carry, taken from the sale's charged lines. */
export function prepaymentTaxTypeFor(
  items: readonly Pick<SunatDocumentItem, "taxType">[],
): SunatTaxAffectationType {
  const charged = items.find((item) => !isGiftTaxType(item.taxType));
  return charged?.taxType ?? SUNAT_TAX_AFFECTATION_TYPES.GRAVADO;
}

/**
 * Turns the sale's document into an anticipo of `amount` (IGV included):
 * one line "Anticipo del pedido …", same customer, series and RUC.
 */
export function toPrepaymentDocument(
  document: FormDocument,
  params: { amount: number; orderNumber?: string | number; taxType: SunatTaxAffectationType },
): FormDocument {
  const amount = round2(Math.max(params.amount, 0));
  const taxed = params.taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO;
  const base = taxed ? round2(amount / (1 + IGV_RATE)) : amount;
  const tax = round2(amount - base);

  return {
    ...document,
    isPrepayment: true,
    prepaymentDocumentIds: undefined,
    items: [
      {
        sku: "ANTICIPO",
        productName: `Anticipo del pedido ${params.orderNumber ?? ""}`.trim(),
        quantity: 1,
        unitPrice: base,
        subtotal: base,
        discountAmount: 0,
        unitCode: UNIT_CODES.SERVICE,
        taxType: params.taxType,
      },
    ],
    totals: {
      ...document.totals,
      subtotal: base,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: tax,
      grandTotal: amount,
    },
  };
}

/** Sum of the anticipos' totals (what the customer already paid). */
export function prepaidAmountOf(prepayments: readonly SunatDocument[]): number {
  return round2(prepayments.reduce((sum, document) => sum + grandTotalOf(document), 0));
}

export function documentNumberOf(document: Pick<SunatDocument, "series" | "correlative">): string {
  return `${document.series}-${document.correlative}`;
}
