/** Questionnaire answers are independent from operational channel configuration. */
export const SALES_CHANNEL_OPTIONS = [
  "Instagram conversacional",
  "WhatsApp conversacional",
  "Facebook conversacional",
  "Shopify con pasarela de pago",
  "Shopify contraentrega",
  "TikTok Live",
  "Mercado Libre",
  "Falabella",
  "Ripley",
  "POS (Punto de venta)",
  "Otras plataformas",
] as const;

export const MONTHLY_ORDER_VOLUME_OPTIONS = [
  { value: "UP_TO_1000", label: "Hasta 1,000" },
  { value: "FROM_1000_TO_2000", label: "1,000 a 2,000" },
  { value: "FROM_2000_TO_6000", label: "2,000 a 6,000" },
  { value: "OVER_6000", label: "Más de 6,000" },
] as const;

export type MonthlyOrderVolume =
  (typeof MONTHLY_ORDER_VOLUME_OPTIONS)[number]["value"];

export interface BusinessQuestionAnswers {
  salesChannels: string[];
  monthlyOrderVolume: MonthlyOrderVolume | "";
}

export interface StoredBusinessQuestionAnswers {
  onboarding_sales_channels?: string[] | null;
  monthly_order_volume?: MonthlyOrderVolume | null;
}

export function hasCompletedBusinessQuestions(company: StoredBusinessQuestionAnswers): boolean {
  return Boolean(
    company.onboarding_sales_channels?.length &&
      company.onboarding_sales_channels.every((channel) =>
        SALES_CHANNEL_OPTIONS.some((option) => option === channel),
      ) &&
      MONTHLY_ORDER_VOLUME_OPTIONS.some((option) => option.value === company.monthly_order_volume),
  );
}

export function businessQuestionErrors(answers: BusinessQuestionAnswers) {
  const errors: Partial<Record<keyof BusinessQuestionAnswers, string>> = {};
  if (!answers.salesChannels.length) {
    errors.salesChannels = "Selecciona al menos un canal de venta.";
  }
  if (!MONTHLY_ORDER_VOLUME_OPTIONS.some((option) => option.value === answers.monthlyOrderVolume)) {
    errors.monthlyOrderVolume = "Selecciona cuántos pedidos despachas al mes.";
  }
  return errors;
}
