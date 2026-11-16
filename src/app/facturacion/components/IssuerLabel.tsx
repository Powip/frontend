"use client";

import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { findIssuerByRuc, getIssuerShortName } from "@/features/sunat/sunat-profile/utils/issuers";

interface IssuerLabelProps {
  /** All the company's SUNAT profiles (for the name lookup). */
  profiles: SunatProfile[];
  /** RUC the document was issued with. */
  ruc: string;
}

/**
 * Issuer line under the document type badge (multi-RUC). Same small muted
 * style as the table's other secondary lines, so no extra column is needed.
 */
export function IssuerLabel({ profiles, ruc }: IssuerLabelProps) {
  // A deleted profile keeps showing the RUC the document was issued with.
  const profile = findIssuerByRuc(profiles, ruc);

  return (
    <div className="mt-1 text-[10px] text-muted-foreground" title={`RUC ${ruc}`}>
      {profile ? getIssuerShortName(profile) : `RUC ${ruc}`}
    </div>
  );
}
