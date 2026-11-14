import type { SunatProfile } from "../models/sunat-profile";
import { getCertificateStatus } from "./get-certificate-status";

/**
 * Multi-RUC helpers. A "SUNAT issuer" is a SUNAT profile: one RUC with its
 * own certificate, SOL credentials and numbering series.
 */

const LEGAL_SUFFIX = /\s+(S\.?A\.?C\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?|S\.?A\.?A\.?|S\.?A\.?)$/i;

/** Active profiles, default first, then by razón social. */
export function getActiveIssuers(profiles: SunatProfile[]): SunatProfile[] {
  return profiles
    .filter((profile) => profile.isActive)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }

      return a.razonSocial.localeCompare(b.razonSocial, "es");
    });
}

/** The company's default active profile, or its first active one. */
export function getDefaultIssuer(profiles: SunatProfile[]): SunatProfile | undefined {
  return getActiveIssuers(profiles)[0];
}

export function findIssuerByRuc(
  profiles: SunatProfile[],
  ruc: string | null | undefined,
): SunatProfile | undefined {
  return ruc ? profiles.find((profile) => profile.ruc === ruc) : undefined;
}

export function getIssuerShortName(profile: Pick<SunatProfile, "razonSocial">): string {
  return profile.razonSocial.trim().replace(LEGAL_SUFFIX, "");
}

export type IssuerBlockReason = "inactive" | "certificate-expired";

/**
 * Whether a profile can sign and send documents right now. Series are
 * checked separately (they depend on the document type).
 */
export function getIssuerBlockReason(profile: SunatProfile): IssuerBlockReason | null {
  if (!profile.isActive) {
    return "inactive";
  }

  if (getCertificateStatus(profile).status === "bad") {
    return "certificate-expired";
  }

  return null;
}

export const ISSUER_BLOCK_MESSAGES: Record<IssuerBlockReason, string> = {
  inactive: "Este RUC está inactivo y no puede emitir comprobantes.",
  "certificate-expired":
    "El certificado digital de este RUC está vencido. Renuévalo en la pestaña Certificado Digital.",
};
