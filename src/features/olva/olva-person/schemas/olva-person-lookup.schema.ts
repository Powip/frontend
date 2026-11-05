import { z } from "zod";
import {
  OLVA_IDENTITY_DOCUMENT_TYPES,
  OLVA_PERSON_ROLES,
} from "../../shared/constants/olva-enums.constants";
import { OLVA_DOCUMENT_NUMBER_LENGTH } from "../constants/olva-person.constants";
import { isValidOlvaDocumentNumber } from "../utils/is-valid-olva-document-number";

export const olvaPersonLookupSchema = z
  .object({
    documentType: z.enum(OLVA_IDENTITY_DOCUMENT_TYPES, { error: "Elige un tipo de documento" }),
    documentNumber: z
      .string({ error: "El número de documento es obligatorio" })
      .trim()
      .min(1, "El número de documento es obligatorio"),
    role: z.enum(OLVA_PERSON_ROLES).optional(),
  })
  .superRefine(({ documentType, documentNumber }, ctx) => {
    // Empty is already reported by `min(1)`; do not stack a second message on it
    if (documentNumber === "" || isValidOlvaDocumentNumber(documentType, documentNumber)) return;

    ctx.addIssue({
      code: "custom",
      path: ["documentNumber"],
      message: `El ${documentType.toUpperCase()} debe tener ${OLVA_DOCUMENT_NUMBER_LENGTH[documentType]} dígitos`,
    });
  });

export type OlvaPersonLookupFormInput = z.input<typeof olvaPersonLookupSchema>;
export type OlvaPersonLookupFormValues = z.output<typeof olvaPersonLookupSchema>;
