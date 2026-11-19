import { IGV_RATE } from "@/features/sunat/shared/constants/sunat.constants";
import type { SunatDocumentSequence } from "../../sunat-document-sequence/models/sunat-document-sequence";
import type { SunatDocumentRequestDto } from "../dto/create-sunat-documents-request.dto";
import {
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "../enums/sunat-document.enums";
import type { SunatDocument, SunatDocumentItem } from "../models/sunat-document.model";
import { calculateSunatDocumentTotals, roundCurrency } from "./calculate-sunat-document-totals";

const ACTIVE_STATUSES: readonly string[] = ["PENDING", "ACCEPTED", "ACCEPTED_WITH_OBSERVATION"];

/**
 * Catalog 09 reasons that cancel the whole comprobante: the note copies the
 * original lines and totals exactly, so the invoice ends fully credited.
 */
export const FULL_CREDIT_REASON_CODES: ReadonlySet<string> = new Set(["01", "02", "06"]);

/** Catalog 09 reasons that are an amount, not a set of lines (04 = descuento global). */
export const AMOUNT_CREDIT_REASON_CODES: ReadonlySet<string> = new Set(["04"]);

export interface CreditNoteLineSelection {
  /** Index of the line in `original.taxDocumentPayload.items`. */
  index: number;
  quantity: number;
}

export interface BuildCreditNoteRequestInput {
  original: SunatDocument;
  series: string;
  reason: { code: string; description: string };
  /** Lines and quantities to credit (partial reasons such as 07 devolución por ítem). */
  lines?: CreditNoteLineSelection[];
  /** Amount with IGV included, for amount reasons (04 descuento global). */
  amount?: number;
}

function partialLine(item: SunatDocumentItem, quantity: number): SunatDocumentItem {
  const ratio = item.quantity > 0 ? quantity / item.quantity : 0;

  return {
    ...item,
    quantity,
    // unitPrice keeps the original full precision (net, IGV excluded).
    subtotal: roundCurrency(quantity * Number(item.unitPrice)),
    discountAmount: roundCurrency(Number(item.discountAmount) * ratio),
  };
}

function amountLine(
  original: SunatDocument,
  amount: number,
  description: string,
): SunatDocumentItem {
  const taxType =
    original.taxDocumentPayload.items[0]?.taxType ?? SUNAT_TAX_AFFECTATION_TYPES.GRAVADO;
  const net = taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO ? amount / (1 + IGV_RATE) : amount;

  return {
    sku: "NC-MONTO",
    productName: description,
    quantity: 1,
    unitPrice: net,
    subtotal: roundCurrency(net),
    discountAmount: 0,
    unitCode: UNIT_CODES.SERVICE,
    taxType,
  };
}

/**
 * Builds the POST /sunat-documents body for a credit note (07) that amends
 * `original`. Lines come from the comprobante already sent to SUNAT, not from
 * the sale, so the note matches what SUNAT has on record.
 */
export function buildCreditNoteRequest(
  input: BuildCreditNoteRequestInput,
): SunatDocumentRequestDto {
  const { original, series, reason } = input;
  const payload = original.taxDocumentPayload;

  let items: SunatDocumentItem[];
  let totals = payload.totals;

  if (FULL_CREDIT_REASON_CODES.has(reason.code)) {
    items = payload.items;
  } else {
    items = AMOUNT_CREDIT_REASON_CODES.has(reason.code)
      ? [amountLine(original, input.amount ?? 0, reason.description)]
      : (input.lines ?? [])
          .filter((line) => line.quantity > 0 && payload.items[line.index])
          .map((line) => partialLine(payload.items[line.index], line.quantity));

    totals = { currency: payload.totals.currency, ...calculateSunatDocumentTotals(items) };
  }

  return {
    orderId: original.orderId,
    taxDocumentType: SUNAT_DOCUMENT_TYPES.CREDIT_NOTE,
    series,
    referenceDocumentId: original.id,
    reason,
    customer: payload.customer,
    totals: {
      currency: totals.currency,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      shippingTotal: totals.shippingTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
    },
    items: items.map((item) => ({
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      discountAmount: item.discountAmount,
      unitCode: item.unitCode,
      taxType: item.taxType,
    })),
  };
}

/**
 * Amount (IGV included) still creditable on `original`: its total minus the
 * credit notes in progress or accepted that already reference it.
 */
export function getCreditableBalance(
  original: SunatDocument,
  documents: readonly SunatDocument[],
): number {
  const credited = documents
    .filter(
      (document) =>
        document.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE &&
        document.referenceDocumentId === original.id &&
        ACTIVE_STATUSES.includes(document.cdrStatus),
    )
    .reduce((sum, note) => sum + (Number(note.taxDocumentPayload?.totals?.grandTotal) || 0), 0);

  return Math.max(
    0,
    roundCurrency(Number(original.taxDocumentPayload.totals.grandTotal) - credited),
  );
}

/**
 * Series for a credit note: SUNAT requires it to start with F when it amends
 * a factura and with B when it amends a boleta. Prefers the default series.
 */
export function resolveCreditNoteSeries(
  sequences: readonly SunatDocumentSequence[],
  originalType: string,
): string | undefined {
  const prefix = originalType === SUNAT_DOCUMENT_TYPES.INVOICE ? "F" : "B";
  const candidates = sequences.filter(
    (sequence) =>
      sequence.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE &&
      sequence.series.toUpperCase().startsWith(prefix),
  );

  return (candidates.find((sequence) => sequence.isDefault) ?? candidates[0])?.series;
}
