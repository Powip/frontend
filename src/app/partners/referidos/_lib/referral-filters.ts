import type { PartnerReferral } from "@/features/partners/models/partner-referral";
import type { ReferralStatus } from "@/features/partners/models/referral-status.enum";

const NOT_ACTIVATED_STATUSES: ReferralStatus[] = [
  "registrado",
  "en_revision",
  "correo_enviado",
  "cuenta_creada",
];

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
      return referrals.filter((referral) => NOT_ACTIVATED_STATUSES.includes(referral.status));
    case "sin_pago":
      return referrals.filter((referral) => referral.status === "activo_sin_pago");
    default:
      return referrals;
  }
}
