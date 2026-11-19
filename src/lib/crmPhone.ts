/**
 * Teléfono de WhatsApp (solo dígitos, con código de país: «51999111222») al
 * formato que guardan los formularios de Powip: 9 dígitos si es de Perú,
 * «+código número» si es de otro país.
 */
export function toLocalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("51")) return digits.slice(2);
  if (digits.length === 9) return digits;
  return digits ? `+${digits}` : "";
}
