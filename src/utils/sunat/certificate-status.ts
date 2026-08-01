import { SunatProfile } from "@/models/sunat/sunat-profile";

export function getCertificateStatus(profile: SunatProfile) {
  const daysToExpire = Math.ceil(
    (new Date(profile.certificate.validUntil).getTime() -
      Date.now()) /
      (1000 * 60 * 60 * 24)
  );

  const status =
    daysToExpire <= 0
      ? "bad"
      : daysToExpire <= 30
        ? "warn"
        : "ok";

  return {
    daysToExpire,
    status,
  };
}
