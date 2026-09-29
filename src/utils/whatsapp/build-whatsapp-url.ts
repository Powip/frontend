// utils/whatsapp.ts

// Normaliza un celular peruano al formato internacional que usa WhatsApp
// (51 + 9 dígitos). Devuelve null si no es un celular válido.
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // 1. Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");

  // 2. Peruvian mobile numbers are 9 digits and start with 9
  if (digits.length === 9 && digits.startsWith("9")) {
    return `51${digits}`;
  }
  // 3. Already has 51 + 9 digits (11 total)
  if (digits.length === 11 && digits.startsWith("519")) {
    return digits;
  }
  // 4. Invalid phone number (e.g. 8-digit DNI like "54325632")
  return null;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
): string | null {
  const fullNumber = toWhatsAppNumber(phone);
  if (!fullNumber) return null;

  const baseUrl = `https://api.whatsapp.com/send?phone=${fullNumber}`;
  return message ? `${baseUrl}&text=${encodeURIComponent(message)}` : baseUrl;
}
