import type { DocumentType } from "@/interfaces/ICliente";
import { isValidRuc } from "@/lib/ruc";

type DocumentErrors = Partial<Record<"documentType" | "documentNumber", string>>;

const documentFormats: Record<DocumentType, { pattern: RegExp | { test: (value: string) => boolean }; message: string }> = {
  // Misma regla que DocumentNumberValidator de ms-ventas: 11 dígitos, prefijo y dígito verificador.
  RUC: {
    pattern: { test: isValidRuc },
    message: "RUC no válido: 11 dígitos que empiecen con 10, 15, 16, 17 o 20.",
  },
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

/**
 * El documento solo es obligatorio en ventas de provincia (el courier lo pide para entregar). Al editar
 * un pedido Shopify COD desde Gestión CC no: el DNI se exige recién al confirmar el despacho, y pedirlo
 * al guardar obligaba a inventar uno para corregir el cliente de un pedido de provincia.
 */
export function isClientDocumentRequired(
  salesRegion: "LIMA" | "PROVINCIA",
  isEditingShopifyCodOrder: boolean,
): boolean {
  return salesRegion === "PROVINCIA" && !isEditingShopifyCodOrder;
}

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

// El correo es opcional; si se escribe, debe tener forma nombre@dominio.tld y sin espacios.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateClientEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return undefined;
  return EMAIL_PATTERN.test(trimmed) ? undefined : "Ingresa un correo válido (ej. nombre@empresa.com).";
}
