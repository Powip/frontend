import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  type WhatsAppTemplateCategory,
} from "../enums/whatsapp.enums";

const PROMOTIONAL_TERMS: { term: string; pattern: RegExp }[] = [
  { term: "descuento", pattern: /\bdescuentos?\b/ },
  { term: "%", pattern: /%/ },
  { term: "código", pattern: /\bcodigos?\b/ },
  { term: "oferta", pattern: /\bofertas?\b/ },
  { term: "promo", pattern: /\bpromo/ },
  { term: "compra ya", pattern: /\bcompra ya\b/ },
  { term: "llévate", pattern: /\bllevate\b/ },
];

function normalizeForMatching(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function findPromotionalTerms(text: string): string[] {
  const normalized = normalizeForMatching(text);
  return PROMOTIONAL_TERMS.filter(({ pattern }) => pattern.test(normalized)).map(
    ({ term }) => term,
  );
}

export function shouldWarnAboutPromotionalLanguage(
  category: WhatsAppTemplateCategory,
  texts: (string | null | undefined)[],
): boolean {
  if (category !== WHATSAPP_TEMPLATE_CATEGORIES.UTILITY) return false;
  return texts.some((text) => !!text && findPromotionalTerms(text).length > 0);
}
