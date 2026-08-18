import type { SunatProfile } from "../models/sunat-profile";

export type CertificateStatus = "ok" | "warn" | "bad" | "unknown";

export function getCertificateStatus(profile: SunatProfile) {
  if (!profile.certificateValidUntil) {
    return {
      daysToExpire: null,
      status: "unknown" as const,
    };
  }

  const daysToExpire = Math.ceil(
    (profile.certificateValidUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const status: CertificateStatus = daysToExpire <= 0 ? "bad" : daysToExpire <= 30 ? "warn" : "ok";

  return {
    daysToExpire,
    status,
  };
}
