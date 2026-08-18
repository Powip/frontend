import { z } from "zod";
import { COUNTRY_CODES } from "../../shared/enums/sunat.enums";
import {
  CURRENCIES,
  IDENTITY_DOCUMENT_TYPES,
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "../enums/sunat-document.enums";

const sunatDocumentCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),

  identityDocumentType: z.enum(IDENTITY_DOCUMENT_TYPES),

  identityDocumentNumber: z.string().trim().min(1, "Document number is required"),

  countryCode: z.enum(COUNTRY_CODES),

  address: z.string().trim().min(1, "Address is required"),
});

const sunatDocumentLineItemSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),

  productName: z.string().trim().min(1, "Product name is required"),

  quantity: z
    .number({
      error: "Quantity is required",
    })
    .positive("Quantity must be greater than zero"),

  unitPrice: z
    .number({
      error: "Unit price is required",
    })
    .nonnegative("Unit price cannot be negative"),

  subtotal: z
    .number({
      error: "Subtotal is required",
    })
    .nonnegative("Subtotal cannot be negative"),

  discountAmount: z
    .number({
      error: "Discount amount is required",
    })
    .nonnegative("Discount amount cannot be negative"),

  unitCode: z.enum(UNIT_CODES),

  taxType: z.enum(SUNAT_TAX_AFFECTATION_TYPES),
});

const sunatDocumentTotalsSchema = z.object({
  currency: z.enum(CURRENCIES),

  subtotal: z.number().nonnegative(),

  discountTotal: z.number().nonnegative(),

  shippingTotal: z.number().nonnegative(),

  taxTotal: z.number().nonnegative(),

  grandTotal: z.number().nonnegative(),
});

const sunatDocumentSchema = z
  .object({
    orderId: z.string().trim().min(1, "Order ID is required"),

    taxDocumentType: z.enum(SUNAT_DOCUMENT_TYPES, {
      error: "Tax document type is required",
    }),

    series: z
      .string({
        error: "Series is required",
      })
      .trim()
      .regex(
        /^[A-Z0-9]{1,4}$/,
        "Series must contain only uppercase letters and numbers",
      ),

    customer: sunatDocumentCustomerSchema.optional(),

    totals: sunatDocumentTotalsSchema,

    items: z
      .array(sunatDocumentLineItemSchema)
      .min(1, "At least one invoice item is required"),
  })
  .superRefine((document, ctx) => {
    if (document.taxDocumentType !== SUNAT_DOCUMENT_TYPES.INVOICE) {
      return;
    }

    if (!document.customer) {
      ctx.addIssue({
        code: "custom",
        message: "Customer information is required for an invoice",
        path: ["customer"],
      });

      return;
    }

    // Customer exists, so its required fields are already
    // validated by sunatDocumentCustomerSchema.
  });

const MAX_DOCUMENTS_PER_REQUEST = 100;

export const createSunatDocumentsSchema = z
  .object({
    documents: z
      .array(sunatDocumentSchema)
      .min(1, "At least one document is required")
      .max(
        MAX_DOCUMENTS_PER_REQUEST,
        `A maximum of ${MAX_DOCUMENTS_PER_REQUEST} documents can be submitted per request`,
      ),
  })
  .superRefine((value, ctx) => {
    const seenOrderIds = new Map<string, number>();

    value.documents.forEach((document, index) => {
      const firstIndex = seenOrderIds.get(document.orderId);

      if (firstIndex === undefined) {
        seenOrderIds.set(document.orderId, index);
        return;
      }

      ctx.addIssue({
        code: "custom",
        message: `Duplicate orderId "${document.orderId}" (already used at documents[${firstIndex}])`,
        path: ["documents", index, "orderId"],
      });
    });
  });

export type CreateSunatDocumentsFormValues = z.infer<
  typeof createSunatDocumentsSchema
>;