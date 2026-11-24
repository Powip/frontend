"use client";

import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGREEMENT_KINDS,
  agreementError,
  agreementExample,
  DEFAULT_TIERS,
  type AgreementKind,
} from "./liveCommission";
import type { LiveAgreement } from "./types";

/** Lo que se escribe en el formulario (texto, para no perder «10,» mientras se tipea). */
export interface AgreementDraft {
  type: AgreementKind;
  value: string;
  period: "MONTH" | "LIVE";
  tiers: { from: string; percent: string }[];
}

const parse = (value: string) => {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(n) ? n : NaN;
};

export function agreementDraft(agreement: LiveAgreement): AgreementDraft {
  const tiers = (agreement.type === "VOLUME" ? agreement.tiers : DEFAULT_TIERS).map((t) => ({
    from: String(t.from),
    percent: String(t.percent),
  }));
  return {
    type: agreement.type,
    value:
      agreement.type === "PER_UNIT"
        ? String(agreement.amount)
        : agreement.type === "VOLUME"
          ? "10"
          : String(agreement.percent),
    period: agreement.type === "VOLUME" ? agreement.period : "MONTH",
    tiers,
  };
}

export function draftAgreement(draft: AgreementDraft): LiveAgreement {
  const value = parse(draft.value);
  if (draft.type === "PER_UNIT") return { type: "PER_UNIT", amount: value };
  if (draft.type === "VOLUME")
    return {
      type: "VOLUME",
      period: draft.period,
      tiers: draft.tiers.map((t) => ({ from: parse(t.from), percent: parse(t.percent) })),
    };
  return { type: draft.type, percent: value };
}

/** Cambiar de tipo conserva el número si tiene sentido (10 % ↔ 10 % de revendedora). */
function switchType(draft: AgreementDraft, type: AgreementKind): AgreementDraft {
  if (type === draft.type) return draft;
  const keep = (draft.type === "PERCENT" || draft.type === "RESELLER") && (type === "PERCENT" || type === "RESELLER");
  return { ...draft, type, value: keep ? draft.value : type === "PER_UNIT" ? "5" : "10" };
}

/**
 * FEAT-33 C1: cómo se calcula la comisión (% sobre la venta, monto por prenda, revendedora o por volumen),
 * con un ejemplo en números reales y el error debajo del campo.
 */
export default function LiveAgreementEditor({
  value,
  onChange,
  product,
  sellerName,
  compact = false,
  showError = true,
  disabled = false,
}: {
  value: AgreementDraft;
  onChange: (draft: AgreementDraft) => void;
  /** Producto para el ejemplo (el primero del live). */
  product: { name: string; regularPrice: number; livePrice: number } | null;
  sellerName?: string;
  /** Sin ejemplo ni escalas editables (invitación). */
  compact?: boolean;
  showError?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const agreement = draftAgreement(value);
  const error = agreementError(agreement);
  const example = !error && !compact ? agreementExample(agreement, product) : "";
  const setTier = (index: number, key: "from" | "percent", text: string) =>
    onChange({ ...value, tiers: value.tiers.map((t, i) => (i === index ? { ...t, [key]: text } : t)) });
  const label =
    value.type === "PERCENT"
      ? "Porcentaje"
      : value.type === "PER_UNIT"
        ? "Por cada prenda vendida"
        : "Su precio: % bajo el precio de tienda";
  return (
    <div className="grid gap-3">
      <div role="group" aria-label="¿Cómo se calcula?" className="grid gap-2 sm:grid-cols-2">
        {AGREEMENT_KINDS.map((kind) => (
          <button
            key={kind.type}
            type="button"
            disabled={disabled}
            aria-pressed={value.type === kind.type}
            onClick={() => onChange(switchType(value, kind.type))}
            className="rounded-xl border-[1.5px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 aria-pressed:border-teal-600 aria-pressed:bg-teal-50 aria-pressed:text-teal-900 disabled:opacity-60"
          >
            <b className="block font-semibold">{kind.label}</b>
            {compact ? null : <small className="text-muted-foreground">{kind.hint}</small>}
          </button>
        ))}
      </div>
      {value.type === "VOLUME" ? (
        compact ? (
          <p className="text-sm text-muted-foreground">
            Usa las escalas sugeridas (
            {value.tiers.map((t) => `desde ${t.from} → ${t.percent}%`).join(", ")}). Las ajustas después en ⚙ Acuerdo.
          </p>
        ) : (
          <div className="grid gap-2">
            <span className="text-sm font-semibold">
              {sellerName ? `Escalas de ${sellerName.split(" ")[0]}` : "Escalas"}
            </span>
            {value.tiers.map((tier, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-12">Desde</span>
                <Input
                  className="w-20"
                  inputMode="numeric"
                  aria-label={`Desde prendas (escala ${index + 1})`}
                  value={tier.from}
                  disabled={disabled || index === 0}
                  onChange={(e) => setTier(index, "from", e.target.value)}
                />
                <span>prendas →</span>
                <Input
                  className="w-20"
                  inputMode="decimal"
                  aria-label={`Porcentaje (escala ${index + 1})`}
                  value={tier.percent}
                  disabled={disabled}
                  onChange={(e) => setTier(index, "percent", e.target.value)}
                />
                <span>%</span>
                {index ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Quitar escala ${index + 1}`}
                    disabled={disabled}
                    onClick={() => onChange({ ...value, tiers: value.tiers.filter((_, i) => i !== index) })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || value.tiers.length >= 10}
                onClick={() => {
                  const last = value.tiers[value.tiers.length - 1];
                  const from = (parse(last?.from ?? "0") || 0) + 10;
                  onChange({ ...value, tiers: [...value.tiers, { from: String(from), percent: last?.percent ?? "10" }] });
                }}
              >
                <Plus className="h-4 w-4" /> Agregar escala
              </Button>
              <label className="ml-auto flex items-center gap-2 text-sm">
                Se cuenta
                <select
                  className="min-h-9 rounded-lg border bg-background px-2"
                  value={value.period}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...value, period: e.target.value as "MONTH" | "LIVE" })}
                >
                  <option value="MONTH">por mes</option>
                  <option value="LIVE">por live</option>
                </select>
              </label>
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-1">
          <label htmlFor={`${id}-value`} className="text-sm font-semibold">
            {label}
          </label>
          <div className="flex max-w-60 items-center gap-2">
            {value.type === "PER_UNIT" ? <b>S/</b> : null}
            <Input
              id={`${id}-value`}
              inputMode="decimal"
              value={value.value}
              disabled={disabled}
              aria-invalid={showError && !!error}
              aria-describedby={showError && error ? `${id}-error` : undefined}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
            />
            {value.type !== "PER_UNIT" ? <b>%</b> : null}
          </div>
        </div>
      )}
      {showError && error ? (
        <span id={`${id}-error`} className="text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
      {example ? (
        <p data-testid="agreement-example" className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {example}
        </p>
      ) : null}
    </div>
  );
}
