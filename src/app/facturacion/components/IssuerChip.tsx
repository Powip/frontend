"use client";

import { Badge } from "@/components/ui/badge";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { findIssuerByRuc, getIssuerShortName } from "@/features/sunat/sunat-profile/utils/issuers";

interface IssuerChipProps {
  /** All the company's SUNAT profiles (for the name lookup). */
  profiles: SunatProfile[];
  /** RUC the document was issued with; `null` = not issued yet. */
  ruc: string | null | undefined;
}

/** "Emisor" cell of the comprobantes table (multi-RUC). */
export function IssuerChip({ profiles, ruc }: IssuerChipProps) {
  if (!ruc) {
    return <span className="text-muted-foreground">—</span>;
  }

  // A deleted profile keeps showing the RUC the document was issued with.
  const profile = findIssuerByRuc(profiles, ruc);

  return (
    <Badge variant="outline" title={`RUC ${ruc}`}>
      {profile ? getIssuerShortName(profile) : `RUC ${ruc}`}
    </Badge>
  );
}
