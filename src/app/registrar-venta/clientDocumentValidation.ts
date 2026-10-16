import type { DocumentType } from "@/interfaces/ICliente";

type DocumentErrors = Partial<Record<"documentType" | "documentNumber", string>>;

const documentFormats: Record<DocumentType, { pattern: RegExp; message: string }> = {
  DNI: {
    pattern: /^\d{7,8}$/,
    message: "DNI debe tener 7 u 8 dígitos.",
  },
  CARNET: {
    pattern: /^[A-Z0-9]{6,12}$/,
    message: "CE debe tener entre 6 y 12 caracteres (letras mayúsculas o números).",
  },
  PASAPORTE: {
    pattern: /^[A-Z0-9]{6,9}$/,
    message: "Pasaporte debe tener entre 6 y 9 caracteres (letras mayúsculas o números).",
  },
};

// Mantener los formatos alineados con DocumentNumberValidator de ms-ventas.
export function validateClientDocument(
  documentType: DocumentType | undefined,
  documentNumber: string,
  isRequired: boolean,
): DocumentErrors {
  const requiredMessage = "El documento de identidad es obligatorio para ventas de provincia.";

  if (!documentType) {
    return isRequired ? { documentType: requiredMessage } : {};
  }

  if (!documentNumber.trim()) {
    return {
      documentNumber: isRequired ? requiredMessage : "Debes completar este dato.",
    };
  }

  const format = documentFormats[documentType];
  if (!format) {
    return { documentType: "Selecciona un tipo de documento válido." };
  }

  return format.pattern.test(documentNumber) ? {} : { documentNumber: format.message };
}
