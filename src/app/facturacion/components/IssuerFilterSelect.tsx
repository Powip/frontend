"use client";

import { Building2, Plus } from "lucide-react";
import type { ExtraRucSummary } from "@/features/sunat/extra-ruc/models/extra-ruc";
import { DEFAULT_EXTRA_RUC_PRICE, formatSoles } from "@/features/sunat/extra-ruc/utils/ruc-slots";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { getActiveIssuers, getIssuerShortName } from "@/features/sunat/sunat-profile/utils/issuers";
import { cn } from "@/lib/utils";

export const ALL_ISSUERS = "all";

/** One dot colour per RUC, in order. Cycles when there are more RUC than colours. */
const ISSUER_COLORS = ["#027778", "#0891B2", "#7C3AED", "#D97706", "#DB2777"];

interface IssuerFilterSelectProps {
  profiles: SunatProfile[];
  /** `ALL_ISSUERS` or a SUNAT profile id. */
  value: string;
  onChange: (value: string) => void;
  /** Rejected documents per RUC, shown as a red badge on each chip. */
  failuresByRuc?: Record<string, number>;
  /** Shows a "+ Agregar RUC" chip that calls this. */
  onAddIssuer?: () => void;
  /** Extra-RUC billing: the monthly total on "Todos los RUC" and the price on "Agregar RUC". */
  summary?: ExtraRucSummary;
}

const chipClass =
  "flex items-center gap-2.5 rounded-xl border bg-background px-3.5 py-2 text-left text-sm font-bold transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * "RUC emisor" filter of the facturación page, as a row of chips: "Todos los
 * RUC" plus one chip per active RUC. Only rendered for multi-RUC companies
 * (two or more active profiles).
 */
export function IssuerFilterSelect({
  profiles,
  value,
  onChange,
  failuresByRuc = {},
  onAddIssuer,
  summary,
}: IssuerFilterSelectProps) {
  const issuers = getActiveIssuers(profiles);

  // Without a way to add a RUC, the bar only makes sense with several RUC.
  if (issuers.length < 2 && !onAddIssuer) {
    return null;
  }

  const showAll = issuers.length >= 2;
  const price = summary?.pricePerRuc ?? DEFAULT_EXTRA_RUC_PRICE;

  return (
    <div role="group" aria-label="RUC emisor" className="flex flex-wrap items-stretch gap-2">
      {showAll && (
        <button
          type="button"
          aria-pressed={value === ALL_ISSUERS}
          onClick={() => onChange(ALL_ISSUERS)}
          className={cn(
            chipClass,
            value === ALL_ISSUERS && "border-primary bg-primary/10 text-primary",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span>
            Todos los RUC
            <small className="block text-[11px] font-medium text-muted-foreground">
              {issuers.length} conectados
              {summary ? ` · +S/ ${formatSoles(summary.monthlyExtraTotal)}/mes` : ""}
            </small>
          </span>
        </button>
      )}

      {issuers.map((issuer, index) => {
        const failures = failuresByRuc[issuer.ruc] ?? 0;
        const selected = value === issuer.id;

        return (
          <button
            key={issuer.id}
            type="button"
            aria-pressed={selected}
            title={`${issuer.razonSocial} · RUC ${issuer.ruc}`}
            onClick={() => onChange(issuer.id)}
            className={cn(chipClass, selected && "border-primary bg-primary/10 text-primary")}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: ISSUER_COLORS[index % ISSUER_COLORS.length] }}
            />
            <span>
              {getIssuerShortName(issuer)}
              <small className="block text-[11px] font-medium text-muted-foreground">
                RUC {issuer.ruc}
              </small>
            </span>
            {failures > 0 && (
              <span
                className="ml-1 rounded-full bg-red-600 px-1.5 py-px text-[10.5px] font-extrabold text-white"
                aria-label={`${failures} con fallos`}
              >
                {failures}
              </span>
            )}
          </button>
        );
      })}

      {onAddIssuer && (
        <button
          type="button"
          onClick={onAddIssuer}
          className={cn(chipClass, "border-dashed text-primary")}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>
            Agregar RUC
            <small className="block text-[11px] font-medium text-muted-foreground">
              S/ {formatSoles(price)}/mes
            </small>
          </span>
        </button>
      )}
    </div>
  );
}
