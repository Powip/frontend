import { z } from "zod";
import {
  DOCUMENT_TYPES,
  IDENTITY_DOCUMENT_TYPES,
  UNIT_CODES,
  TAX_TYPES,
  CURRENCIES,
} from "../../api/sunat/types/sunat-document.types";

const documentTypeSchema = z.enum(DOCUMENT_TYPES);

const identityDocumentTypeSchema = z.enum(IDENTITY_DOCUMENT_TYPES);

const unitCodeSchema = z.enum(UNIT_CODES);

const taxTypeSchema = z.enum(TAX_TYPES);

const currencySchema = z.enum(CURRENCIES);

export const invoiceCustomerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),

  documentType: identityDocumentTypeSchema,

  documentNumber: z.string().min(1, "El número de documento es requerido"),

  address: z.string().optional(),
});

export const invoiceItemSchema = z.object({
  internalCode: z.string().min(1, "El código interno es requerido"),

  description: z.string().min(1, "La descripción es requerida"),

  quantity: z.number().positive("La cantidad debe ser mayor a 0"),

  unitPrice: z.number().positive("El precio unitario debe ser mayor a 0"),

  unitCode: unitCodeSchema,

  taxType: taxTypeSchema,
});

export const invoiceTotalsSchema = z.object({
  totalTax: z.number().min(0, "El impuesto total no puede ser negativo"),

  totalValue: z.number().min(0, "El valor total no puede ser negativo"),

  totalPrice: z.number().min(0, "El precio total no puede ser negativo"),

  currency: currencySchema,
});

export const createManualInvoiceSchema = z.object({
  externalId: z.string().min(1),

  documentType: documentTypeSchema,

  customer: invoiceCustomerSchema,

  totals: invoiceTotalsSchema,

  items: z
    .array(invoiceItemSchema)
    .min(1, "Debe registrar al menos un ítem"),

})
.superRefine((data, ctx) => {

  const { documentType, customer, totals, items } = data;

  // Defense-in-depth: totals must reconcile with items. This is what
  // was missing before — totals could silently drift from items (a
  // frozen 0/0/grandTotal that never got recomputed), and nothing
  // caught it before submission. Mirrors the same epsilon check the
  // backend's invoice.template.ts does, just earlier, so the user
  // sees the error before emitting instead of only discovering it on
  // a mismatched PDF/log later.
  const IGV_RATE = 0.18;
  const EPSILON = 0.01;

  const computedPrice = items.reduce((sum, item) => {
    const isGravado = item.taxType === "10";
    const unitValue = isGravado
      ? item.unitPrice / (1 + IGV_RATE)
      : item.unitPrice;
    return sum + unitValue * item.quantity * (isGravado ? 1 + IGV_RATE : 1);
  }, 0);

  if (Math.abs(totals.totalPrice - computedPrice) > EPSILON) {
    ctx.addIssue({
      code: "custom",
      path: ["totals", "totalPrice"],
      message:
        "El total no coincide con la suma de los ítems. Revisa si falta algún ítem (ej. costo de entrega).",
    });
  }

  if (documentType === DOCUMENT_TYPES.FACTURA) {

    if (!/^(10|20)\d{9}$/.test(customer.documentNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["customer", "documentNumber"],
        message:
          "Para factura se requiere un RUC válido",
      });
    }

    if (!customer.address) {
      ctx.addIssue({
        code: "custom",
        path: ["customer", "address"],
        message:
          "La dirección fiscal es obligatoria para facturas",
      });
    }

  }

  if (documentType === DOCUMENT_TYPES.BOLETA) {

    if (
      customer.documentType === "1" &&
      customer.documentNumber.length !== 8
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["customer", "documentNumber"],
        message:
          "El DNI debe tener 8 dígitos",
      });
    }

  }

});

export type CreateManualInvoiceInput = z.infer<
  typeof createManualInvoiceSchema
>;
