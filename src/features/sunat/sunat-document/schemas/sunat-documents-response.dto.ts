import { z } from "zod";
import { COUNTRY_CODES } from "../../shared/enums/sunat.enums.js";
import {
  CURRENCIES,
  IDENTITY_DOCUMENT_TYPES,
  SUNAT_DOCUMENT_CDR_STATUSES,
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "../enums/sunat-document.enums.js";

/**
 * Customer / receiver information.
 */
export const sunatUblCustomerSchema = z.object({
  name: z.string().optional(),

  identityDocumentType: z.enum(IDENTITY_DOCUMENT_TYPES).optional(),

  identityDocumentNumber: z.string().optional(),

  countryCode: z.enum(COUNTRY_CODES).optional(),

  address: z.string().optional(),
});

/**
 * Individual tax document line.
 */
export const sunatUblItemSchema = z.object({
  sku: z.string(),

  productName: z.string(),

  quantity: z.number(),

  unitPrice: z.number(),

  subtotal: z.number(),

  discountAmount: z.number(),

  unitCode: z.enum(UNIT_CODES),

  taxType: z.enum(SUNAT_TAX_AFFECTATION_TYPES),
});

/**
 * Monetary totals used to construct the UBL document.
 */
export const sunatUblTotalsSchema = z.object({
  currency: z.enum(CURRENCIES),

  subtotal: z.number(),

  discountTotal: z.number(),

  shippingTotal: z.number(),

  taxTotal: z.number(),

  grandTotal: z.number(),
});

export const sunatDocumentResponseSchema = z.object({
  id: z.uuid(),

  orderId: z.string(),

  companyId: z.string(),

  rucIssuer: z.string().regex(/^\d{11}$/, "RUC must contain 11 digits"),

  taxDocumentType: z.enum(SUNAT_DOCUMENT_TYPES),

  series: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{1,4}$/, "Series must contain only uppercase letters and numbers"),

  correlative: z.string().regex(/^\d{8}$/, "Correlative must contain exactly 8 digits"),

  issueDate: z.iso.date(),

  cdrStatus: z.enum(SUNAT_DOCUMENT_CDR_STATUSES),

  sunatCode: z.string().nullable(),

  sunatDescription: z.string().nullable(),

  observations: z.string().nullable(),

  signedXmlStoragePath: z.string().nullable(),

  cdrStoragePath: z.string().nullable(),

  digestValue: z.string().nullable(),

  taxDocumentPayload: z.object({
    customer: sunatUblCustomerSchema.optional(),
    totals: sunatUblTotalsSchema,
    items: z.array(sunatUblItemSchema),
  }),

  referenceDocumentId: z.uuid().nullable(),

  createdAt: z.iso.datetime(),

  updatedAt: z.iso.datetime(),
});

export type SunatDocumentResponseDto = z.infer<typeof sunatDocumentResponseSchema>;

/*
 * One entry per document submitted in the batch, in the same order as the
 * request. A successful entry is IDENTICAL to the single-create response
 * (no extra fields added) — a failed entry is the only shape that carries
 * `error`, so the frontend distinguishes them by presence of `id` vs `error`.
 */
const sunatDocumentBulkErrorResultSchema = z.object({
  orderId: z.string(),

  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const sunatDocumentBulkResultSchema = z.union([
  sunatDocumentResponseSchema,
  sunatDocumentBulkErrorResultSchema,
]);

export const createSunatDocumentsResponseSchema = z.object({
  results: z.array(sunatDocumentBulkResultSchema),
});

export type SunatDocumentBulkResultDto = z.infer<typeof sunatDocumentBulkResultSchema>;
export type CreateSunatDocumentsResponseDto = z.infer<typeof createSunatDocumentsResponseSchema>;
