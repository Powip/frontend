import { Skeleton } from "@/components/ui/skeleton";
import { waScopeTag } from "@/components/whatsapp/ui/wa-classes";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppCatalogOption } from "@/features/whatsapp/models/scope-catalog.model";
import { cn } from "@/lib/utils";

interface ScopeChipGroupProps {
  legend: string;
  allLabel: string;
  emptyLabel: string;
  catalog: WhatsAppResourceState<WhatsAppCatalogOption[]>;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export const SCOPE_ROW =
  "grid grid-cols-1 items-center gap-2.5 text-[12.5px] sm:grid-cols-[110px_minmax(0,1fr)]";

export const SCOPE_ROW_LABEL = "font-medium text-wa-muted";

export function ScopeChipGroup({
  legend,
  allLabel,
  emptyLabel,
  catalog,
  value,
  onChange,
  disabled = false,
}: ScopeChipGroupProps) {
  const options = catalog.kind === "ready" ? catalog.data : [];
  const knownValues = new Set(options.map((option) => option.value));
  const unknownSelected =
    catalog.kind === "ready" ? value.filter((selected) => !knownValues.has(selected)) : [];

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((selected) => selected !== optionValue)
        : [...value, optionValue],
    );
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <div className={SCOPE_ROW}>
        <span className={SCOPE_ROW_LABEL} aria-hidden="true">
          {legend}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          {catalog.kind === "loading" && (
            <div role="status" className="flex gap-1.5">
              <span className="sr-only">Cargando {legend.toLowerCase()}</span>
              <Skeleton className="h-6 w-16 rounded-full bg-wa-surface" />
              <Skeleton className="h-6 w-20 rounded-full bg-wa-surface" />
            </div>
          )}
          {catalog.kind === "error" && <p className="m-0 text-xs text-wa-red">{catalog.message}</p>}
          {catalog.kind === "pending-integration" && (
            <p className="m-0 text-xs text-wa-muted">Catálogo pendiente de integración.</p>
          )}
          {catalog.kind === "forbidden" && (
            <p className="m-0 text-xs text-wa-muted">No tienes permiso para ver este catálogo.</p>
          )}
          {catalog.kind !== "ready" && value.length > 0 && (
            <p className="m-0 text-xs text-wa-muted">
              {value.length} {value.length === 1 ? "seleccionado" : "seleccionados"}; se conservan
              aunque el catálogo no esté disponible.
            </p>
          )}
          {catalog.kind === "ready" && options.length === 0 && (
            <p className="m-0 text-xs text-wa-muted">{emptyLabel}</p>
          )}
          {(options.length > 0 || unknownSelected.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {options.length > 0 && (
                <button
                  type="button"
                  aria-pressed={value.length === 0}
                  className={waScopeTag}
                  onClick={() => onChange([])}
                >
                  {allLabel}
                </button>
              )}
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={value.includes(option.value)}
                  className={waScopeTag}
                  onClick={() => toggle(option.value)}
                >
                  {option.label}
                </button>
              ))}
              {unknownSelected.map((selected) => (
                <button
                  key={selected}
                  type="button"
                  aria-pressed
                  title="Este valor ya no aparece en el catálogo. Tócalo para quitarlo."
                  className={cn(
                    waScopeTag,
                    "border-dashed aria-pressed:border-wa-amber aria-pressed:bg-wa-amber-soft aria-pressed:text-wa-amber",
                  )}
                  onClick={() => toggle(selected)}
                >
                  {selected} (no disponible)
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
