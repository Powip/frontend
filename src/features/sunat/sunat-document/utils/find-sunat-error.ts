import { ERRORES_SUNAT, type ErrorSunat } from "@/types/facturacion";

/**
 * El código que guarda el backend en `sunatCode` termina siempre en el número
 * de SUNAT, sea el de un CDR ("2335", "0156") o el de una falla SOAP
 * ("soap-env:Client.1033").
 */
function codeFromSunatCode(sunatCode: string | null): number | null {
  const digits = sunatCode ? /(\d+)\s*$/.exec(sunatCode)?.[1] : undefined;

  return digits === undefined ? null : Number.parseInt(digits, 10);
}

/**
 * Respaldo para cuando no hay `sunatCode`: el OSE antepone el código a su
 * mensaje ("1033 - El comprobante fue registrado previamente ..."). Solo vale
 * el número del inicio seguido de un guion; un número suelto más adelante en
 * el texto (un ticket, un correlativo, un "intento 10") no es un código.
 */
function codeFromDescription(sunatDescription: string | null): number | null {
  const digits = sunatDescription
    ? /^\s*(\d{1,4})\s*[-–—:]/.exec(sunatDescription)?.[1]
    : undefined;

  return digits === undefined ? null : Number.parseInt(digits, 10);
}

/**
 * Busca en el catálogo el error de SUNAT que corresponde a un comprobante.
 *
 * Compara el código EXACTO. Antes se usaba `descripcion.includes(codigo)`, y
 * como el primer código del catálogo es "0" ("Ninguna — comprobante válido"),
 * cualquier descripción con un 0 (p. ej. "1033 - ...") mostraba un falso
 * "comprobante válido" junto a un comprobante rechazado.
 */
export function findSunatError(
  sunatCode: string | null,
  sunatDescription: string | null,
  catalog: ErrorSunat[] = ERRORES_SUNAT,
): ErrorSunat | undefined {
  const candidates = [codeFromSunatCode(sunatCode), codeFromDescription(sunatDescription)];

  for (const candidate of candidates) {
    if (candidate === null) {
      continue;
    }

    const found = catalog.find((entry) => Number.parseInt(entry.code, 10) === candidate);

    if (found) {
      return found;
    }
  }

  return undefined;
}
