import { toWhatsAppNumber } from "@/utils/whatsapp/build-whatsapp-url";

export function normalizeOptOutPhone(raw: string): string | null {
  return toWhatsAppNumber(raw);
}

export function formatPeruWhatsAppNumber(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("51")) return normalized;
  const local = digits.slice(2);
  return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
