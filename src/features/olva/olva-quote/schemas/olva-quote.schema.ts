import { z } from "zod";
import {
  OLVA_DELIVERY_TYPES,
  OLVA_QUOTE_SHIPMENT_TYPES,
} from "../../shared/constants/olva-enums.constants";

const ubigeoSchema = (label: string) =>
  z
    .string({ error: `${label} es obligatorio` })
    .trim()
    .regex(/^\d{6}$/, { error: `${label} debe ser un ubigeo de 6 dígitos` });

const DIMENSION_FIELDS = [
  ["lengthCm", "El largo"],
  ["widthCm", "El ancho"],
  ["heightCm", "El alto"],
] as const;

// Text inputs hand over "" for a blank dimension
const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const dimensionSchema = (label: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number<unknown>({ error: `${label} debe ser un número` })
      .positive({ error: `${label} debe ser mayor a 0` })
      .optional(),
  );

// `z.coerce` lets a text input feed numbers; the form keeps strings, the output has numbers
export const olvaQuoteSchema = z
  .object({
    originUbigeo: ubigeoSchema("El origen"),
    destinationUbigeo: ubigeoSchema("El destino"),
    deliveryType: z.enum(OLVA_DELIVERY_TYPES, { error: "Elige el tipo de entrega" }),
    shipmentType: z.coerce
      .number<unknown>({ error: "Elige el tipo de envío" })
      .pipe(
        z.literal(Object.values(OLVA_QUOTE_SHIPMENT_TYPES), { error: "Elige el tipo de envío" }),
      ),
    weightKg: z.coerce
      .number<unknown>({ error: "El peso es obligatorio" })
      .min(0.01, { error: "El peso mínimo es 0.01 kg" }),
    lengthCm: dimensionSchema("El largo"),
    widthCm: dimensionSchema("El ancho"),
    heightCm: dimensionSchema("El alto"),
    partnerRate: z.boolean().default(false),
  })
  .superRefine((quote, ctx) => {
    // Olva's calculator answers 422 for a parcel without its measures (a document ignores them)
    if (quote.shipmentType !== OLVA_QUOTE_SHIPMENT_TYPES.PACKAGE) return;

    for (const [field, label] of DIMENSION_FIELDS) {
      if (quote[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${label} es obligatorio para un paquete`,
        });
      }
    }
  });

export type OlvaQuoteFormInput = z.input<typeof olvaQuoteSchema>;
export type OlvaQuoteFormValues = z.output<typeof olvaQuoteSchema>;
