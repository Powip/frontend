"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { getActiveIssuers } from "@/features/sunat/sunat-profile/utils/issuers";

export const ALL_ISSUERS = "all";

interface IssuerFilterSelectProps {
  profiles: SunatProfile[];
  /** `ALL_ISSUERS` or a SUNAT profile id. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * "RUC emisor" filter of the facturación page. Only rendered for multi-RUC
 * companies (two or more active profiles).
 */
export function IssuerFilterSelect({ profiles, value, onChange }: IssuerFilterSelectProps) {
  const issuers = getActiveIssuers(profiles);

  if (issuers.length < 2) {
    return null;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-64" aria-label="RUC emisor">
        <SelectValue placeholder="Todos los RUC" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={ALL_ISSUERS}>Todos los RUC</SelectItem>
        {issuers.map((issuer) => (
          <SelectItem key={issuer.id} value={issuer.id}>
            {issuer.razonSocial} · {issuer.ruc}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
