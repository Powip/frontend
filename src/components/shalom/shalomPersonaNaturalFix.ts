/**
 * Caso «La declaración jurada solo es para persona natural» de Shalom.
 *
 * Shalom rechaza la declaración jurada cuando el destinatario se identifica con RUC.
 * Si el usuario quiere mantener la declaración, puede reenviar ese envío con el DNI
 * del cliente. El DNI solo viaja en el envío (packageDetails.recipientDoc); el RUC del
 * cliente no se toca, porque lo usa la facturación.
 */

export const PERSONA_NATURAL_DNI_HINT =
  "Si desea continuar con la declaración jurada, ingrese el DNI del cliente (actualmente solo tiene RUC)";

/** True si el mensaje de Shalom es el rechazo de declaración jurada por no ser persona natural. */
export function isPersonaNaturalError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /persona\s+natural/i.test(message) && /declaraci[oó]n\s+jurada/i.test(message);
}

/** RUC peruano: 11 dígitos. */
export function isRucDoc(doc: string | null | undefined): boolean {
  return /^\d{11}$/.test((doc ?? "").trim());
}

/** DNI peruano: 8 dígitos. */
export function isDniDoc(doc: string | null | undefined): boolean {
  return /^\d{8}$/.test((doc ?? "").trim());
}

/**
 * Solo se ofrece el reenvío con DNI cuando se cumplen las tres condiciones:
 * hay declaración jurada, el documento enviado es RUC y Shalom devolvió ese error.
 */
export function needsDniForDeclaracion(params: {
  error: string | null | undefined;
  recipientDoc: string | null | undefined;
  declaracionJurada: string | null | undefined;
}): boolean {
  return (
    !!params.declaracionJurada?.trim() &&
    isRucDoc(params.recipientDoc) &&
    isPersonaNaturalError(params.error)
  );
}
