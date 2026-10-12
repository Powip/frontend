import z from "zod";
import type { PartnerReferralMetrics } from "../models/partner-referral-metrics";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const utcInstant = z.iso.datetime().refine((value) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.exec(value);
  if (!parts) return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === Number(parts[1]) &&
    parsed.getUTCMonth() + 1 === Number(parts[2]) &&
    parsed.getUTCDate() === Number(parts[3])
  );
}, "La fecha debe ser un instante UTC válido.");

export const partnerReferralMetricsSchema = z
  .object({
    claimCaptures: count,
    attachedClaims: count,
    attributedCompanies: count,
    asOf: utcInstant,
  })
  .strict() satisfies z.ZodType<PartnerReferralMetrics>;
