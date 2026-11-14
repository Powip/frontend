"use client";

import { AlertTriangle } from "lucide-react";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import {
  getActiveIssuers,
  getIssuerBlockReason,
  getIssuerColor,
  getIssuerShortName,
} from "@/features/sunat/sunat-profile/utils/issuers";
import { cn } from "@/lib/utils";

export const ALL_ISSUERS = "all";

interface IssuerBarProps {
  profiles: SunatProfile[];
  /** `ALL_ISSUERS` or a SUNAT profile id. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * RUC selector shown above the facturación tabs. Only rendered for
 * multi-RUC companies (two or more active profiles).
 */
export function IssuerBar({ profiles, value, onChange }: IssuerBarProps) {
  const issuers = getActiveIssuers(profiles);

  if (issuers.length < 2) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-stretch gap-2" role="radiogroup" aria-label="RUC emisor">
      <IssuerOption
        selected={value === ALL_ISSUERS}
        onSelect={() => onChange(ALL_ISSUERS)}
        title="Todos los RUC"
        subtitle={`${issuers.length} emisores`}
      />

      {issuers.map((issuer) => {
        const color = getIssuerColor(profiles, issuer.id);
        const blocked = getIssuerBlockReason(issuer) !== null;

        return (
          <IssuerOption
            key={issuer.id}
            selected={value === issuer.id}
            onSelect={() => onChange(issuer.id)}
            title={getIssuerShortName(issuer)}
            subtitle={`RUC ${issuer.ruc}${issuer.isDefault ? " · predeterminado" : ""}`}
            color={color}
            warning={blocked ? "Certificado vencido" : undefined}
          />
        );
      })}
    </div>
  );
}

function IssuerOption(props: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  color?: string;
  warning?: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: chip styling needs a button, not a native radio input
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      onClick={props.onSelect}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border bg-background px-3.5 py-2 text-left text-sm font-bold text-muted-foreground transition-colors hover:bg-muted/60",
        props.selected && "border-primary bg-primary/10 text-primary",
      )}
    >
      {props.color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: props.color }}
        />
      )}
      <span>
        {props.title}
        <small className="block text-[11px] font-medium text-muted-foreground">
          {props.subtitle}
        </small>
      </span>
      {props.warning && (
        <span title={props.warning} className="text-red-600">
          <AlertTriangle className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
