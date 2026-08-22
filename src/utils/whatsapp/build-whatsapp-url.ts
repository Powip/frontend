// utils/whatsapp.ts
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
): string | null {
  if (!phone) return null;

  // 1. Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");

  let fullNumber = "";

  // 2. Peruvian mobile numbers are 9 digits and start with 9
  if (digits.length === 9 && digits.startsWith("9")) {
    fullNumber = `51${digits}`;
  } 
  // 3. Already has 51 + 9 digits (11 total)
  else if (digits.length === 11 && digits.startsWith("519")) {
    fullNumber = digits;
  } 
  // 4. Invalid phone number (e.g. 8-digit DNI like "54325632")
  else {
    return null;
  }

  const baseUrl = `https://api.whatsapp.com/send?phone=${fullNumber}`;
  return message ? `${baseUrl}&text=${encodeURIComponent(message)}` : baseUrl;
}