/** El teléfono viene oculto («951 *** 245»): solo sirve para mostrarlo. */
export function isMaskedPhone(phone: string | null | undefined): boolean {
  return !!phone && phone.includes("*");
}

/**
 * Teléfono de WhatsApp (solo dígitos, con código de país: «51999111222») al
 * formato que guardan los formularios de Powip: 9 dígitos si es de Perú,
 * «+código número» si es de otro país.
 */
export function toLocalPhone(raw: string): string {
  if (isMaskedPhone(raw)) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("51")) return digits.slice(2);
  if (digits.length === 9) return digits;
  return digits ? `+${digits}` : "";
}

/**
 * Enlace `tel:` de un teléfono, o null si no parece uno (p. ej. el identificador
 * de un contacto de Instagram). Un número de 9 dígitos se toma como peruano.
 */
export function telHref(raw: string | null | undefined): string | null {
  if (isMaskedPhone(raw)) return null;
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:+${digits.length === 9 ? `51${digits}` : digits}`;
}
