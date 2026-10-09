import { Skeleton } from "@/components/ui/skeleton";
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

const chipClassName =
  "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const selectedClassName =
  "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-500/15 dark:text-teal-200";

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
    <fieldset className="min-w-0 space-y-1.5" disabled={disabled}>
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      {catalog.kind === "loading" && (
        <div role="status" className="flex gap-2">
          <span className="sr-only">Cargando {legend.toLowerCase()}</span>
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      )}
      {catalog.kind === "error" && (
        <p className="text-xs text-red-700 dark:text-red-300">{catalog.message}</p>
      )}
      {catalog.kind === "pending-integration" && (
        <p className="text-xs text-muted-foreground">Catálogo pendiente de integración.</p>
      )}
      {catalog.kind === "forbidden" && (
        <p className="text-xs text-muted-foreground">No tienes permiso para ver este catálogo.</p>
      )}
      {catalog.kind !== "ready" && value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} {value.length === 1 ? "seleccionado" : "seleccionados"}; se conservan
          aunque el catálogo no esté disponible.
        </p>
      )}
      {catalog.kind === "ready" && options.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      )}
      {(options.length > 0 || unknownSelected.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {options.length > 0 && (
            <button
              type="button"
              aria-pressed={value.length === 0}
              className={cn(chipClassName, value.length === 0 && selectedClassName)}
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
              className={cn(chipClassName, value.includes(option.value) && selectedClassName)}
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
                chipClassName,
                "border-dashed border-amber-500 text-amber-800 dark:text-amber-200",
              )}
              onClick={() => toggle(selected)}
            >
              {selected} (no disponible)
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
