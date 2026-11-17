/** SUNAT's "código de local anexo": 4 digits, "0000" = casa matriz. */
export const ESTABLISHMENT_CODE_PATTERN = /^\d{4}$/;

export const ESTABLISHMENT_CODE_ERROR = "Debe tener 4 dígitos. Usa 0000 si es la casa matriz.";

export function isValidEstablishmentCode(code: string): boolean {
  return ESTABLISHMENT_CODE_PATTERN.test(code.trim());
}
