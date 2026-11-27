import { z } from "zod";
import {
  OLVA_ORDER_CODE_LENGTH,
  OLVA_ORDER_NUMBER_MAX_LENGTH,
  OLVA_ORDER_NUMBER_MIN_LENGTH,
  OLVA_TRACKING_BATCH_MAX_SIZE,
} from "../constants/olva-tracking.constants";

const ORDER_NUMBER = new RegExp(
  `^\\d{${OLVA_ORDER_NUMBER_MIN_LENGTH},${OLVA_ORDER_NUMBER_MAX_LENGTH}}$`,
);

export const olvaTrackingLookupSchema = z.object({
  orderNumber: z
    .string({ error: "El número de guía es obligatorio" })
    .trim()
    .min(1, { error: "El número de guía es obligatorio" })
    // Empty is already reported by `min(1)`; do not stack a second message on it
    .refine((value) => value === "" || ORDER_NUMBER.test(value), {
      error: `El número de guía debe tener entre ${OLVA_ORDER_NUMBER_MIN_LENGTH} y ${OLVA_ORDER_NUMBER_MAX_LENGTH} dígitos`,
    }),
  // Blank means "the current year": it leaves the form as `undefined`
  orderCode: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(
      z
        .string()
        .regex(new RegExp(`^\\d{${OLVA_ORDER_CODE_LENGTH}}$`), {
          error: `El año debe tener ${OLVA_ORDER_CODE_LENGTH} dígitos (por ejemplo, 26)`,
        })
        .optional(),
    ),
});

export const olvaTrackingBatchSchema = z.object({
  shipments: z
    .array(olvaTrackingLookupSchema)
    .min(1, { error: "Agrega al menos una guía" })
    .max(OLVA_TRACKING_BATCH_MAX_SIZE, {
      error: `Puedes consultar hasta ${OLVA_TRACKING_BATCH_MAX_SIZE} guías a la vez`,
    }),
});

export type OlvaTrackingLookupFormInput = z.input<typeof olvaTrackingLookupSchema>;
export type OlvaTrackingLookupFormValues = z.output<typeof olvaTrackingLookupSchema>;
export type OlvaTrackingBatchFormInput = z.input<typeof olvaTrackingBatchSchema>;
export type OlvaTrackingBatchFormValues = z.output<typeof olvaTrackingBatchSchema>;
