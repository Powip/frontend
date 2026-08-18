import z from "zod";
import { SUNAT_DOCUMENT_TYPES } from "../../sunat-document/enums/sunat-document.enums";

export const initializeSunatDocumentSequenceSchema = z.object({
  taxDocumentType: z.enum(SUNAT_DOCUMENT_TYPES, {
    error: "Tax document type is required",
  }),

  series: z
    .string({
      error: "Series is required",
    })
    .trim()
    .regex(/^[A-Z0-9]{1,4}$/, "Series must contain only uppercase letters and numbers"),

  lastCorrelative: z
    .number({
      error: "Last correlative is required",
    })
    .int("Last correlative must be an integer")
    .nonnegative("Last correlative cannot be negative"),
});

export type InitializeSunatDocumentSequenceFormValues = z.infer<
  typeof initializeSunatDocumentSequenceSchema
>;
