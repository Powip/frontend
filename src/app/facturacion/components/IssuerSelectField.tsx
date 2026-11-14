"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IssuerSelection } from "@/features/sunat/sunat-profile/hooks/use-issuer-selection";
import {
  getIssuerColor,
  ISSUER_BLOCK_MESSAGES,
} from "@/features/sunat/sunat-profile/utils/issuers";

interface IssuerSelectFieldProps {
  selection: IssuerSelection;
  /** Extra line under the select, e.g. the next document number. */
  hint?: React.ReactNode;
  disabled?: boolean;
}

/**
 * "Emisor (RUC)" field of the emission modals. Multi-RUC companies pick the
 * RUC; single-RUC companies just see which RUC will be used.
 */
export function IssuerSelectField({ selection, hint, disabled }: IssuerSelectFieldProps) {
  const { issuers, selected, selectIssuer, blockReason, isMultiRuc, profiles } = selection;

  if (issuers.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="issuer-select">Emisor (RUC)</Label>

      {isMultiRuc ? (
        <Select value={selected?.id ?? ""} onValueChange={selectIssuer} disabled={disabled}>
          <SelectTrigger id="issuer-select" aria-label="Emisor (RUC)">
            <SelectValue placeholder="Selecciona el RUC emisor" />
          </SelectTrigger>

          <SelectContent>
            {issuers.map((issuer) => (
              <SelectItem key={issuer.id} value={issuer.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getIssuerColor(profiles, issuer.id) }}
                  />
                  {issuer.razonSocial} · RUC {issuer.ruc}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm font-medium">
          {selected?.razonSocial} · RUC {selected?.ruc}
        </p>
      )}

      {blockReason ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {ISSUER_BLOCK_MESSAGES[blockReason]}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
