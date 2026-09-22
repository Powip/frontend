import type { PartnerReferral } from "@/features/partners/models/partner-referral";

export type ReferralFilterKey = "all" | "pagando" | "sin_activar" | "sin_pago";

export const REFERRAL_FILTERS: { key: ReferralFilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pagando", label: "Pagando" },
  { key: "sin_activar", label: "Sin activar cuenta" },
  { key: "sin_pago", label: "Activó sin pagar" },
];

export function filterReferrals(
  referrals: PartnerReferral[],
  filter: ReferralFilterKey,
): PartnerReferral[] {
  switch (filter) {
    case "pagando":
      return referrals.filter((referral) => referral.status === "pagando");
    case "sin_activar":
      return referrals.filter(
        (referral) => referral.status === "correo_enviado" || referral.status === "cuenta_creada",
      );
    case "sin_pago":
      return referrals.filter(
        (referral) => referral.status === "activo_sin_pago" || referral.status === "en_revision",
      );
    default:
      return referrals;
  }
}
