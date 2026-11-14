"use client";

import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import {
  findIssuerByRuc,
  getIssuerColor,
  getIssuerShortName,
} from "@/features/sunat/sunat-profile/utils/issuers";

interface IssuerChipProps {
  /** All the company's SUNAT profiles (for name and color lookup). */
  profiles: SunatProfile[];
  /** RUC the document was issued with; `null` = not issued yet. */
  ruc: string | null | undefined;
}

/** Colored "emisor" chip used in the comprobantes table (multi-RUC). */
export function IssuerChip({ profiles, ruc }: IssuerChipProps) {
  if (!ruc) {
    return <span className="text-muted-foreground">—</span>;
  }

  const profile = findIssuerByRuc(profiles, ruc);

  if (!profile) {
    // Profile deleted after issuing: the document keeps its RUC.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        RUC {ruc}
      </span>
    );
  }

  const color = getIssuerColor(profiles, profile.id);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold"
      style={{ color, backgroundColor: `${color}1f` }}
      title={`${profile.razonSocial} · RUC ${profile.ruc}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {getIssuerShortName(profile)}
    </span>
  );
}
