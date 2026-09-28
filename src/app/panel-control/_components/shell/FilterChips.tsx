"use client";

import { X } from "lucide-react";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import type { DimensionFilterKey } from "@/features/panel-control/shared/models/panel-filters.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { getActiveFilterChips } from "@/features/panel-control/shared/utils/filter-chips";

export function FilterChips() {
  const { view, dispatch } = usePanel();
  const options = usePanelOptions();
  if (view.access !== "permitido") return null;

  const bloqueados = new Set<DimensionFilterKey>(view.asesorFijo ? ["asesorId"] : []);
  const chips = getActiveFilterChips(
    view.filters,
    { tienda: options.tiendaNombre, canal: options.canalNombre, asesor: options.asesorNombre },
    bloqueados,
  );
  if (!chips.length) return null;
  const removibles = chips.filter((chip) => !chip.bloqueado);

  return (
    <section
      aria-label="Filtros activos"
      className="flex flex-wrap items-center gap-1.5 border-b border-pc-border bg-pc-card px-4 py-2 sm:px-6"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-pc-primary-line bg-pc-primary-soft py-0.5 pl-3 pr-1 text-xs text-pc-primary-strong"
        >
          {chip.label}: <b className="font-semibold">{chip.value}</b>
          {chip.bloqueado ? (
            <span className="pr-2 text-[10.5px] text-pc-text-muted">(fijo por rol)</span>
          ) : (
            <button
              type="button"
              aria-label={`Quitar filtro ${chip.label}: ${chip.value}`}
              onClick={() => dispatch({ type: "set_filter", key: chip.key, value: null })}
              className="grid size-5 place-items-center rounded-full bg-pc-card text-pc-primary-strong outline-none hover:text-pc-bad focus-visible:ring-2 focus-visible:ring-pc-primary"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </span>
      ))}
      {removibles.length > 1 && (
        <button
          type="button"
          onClick={() => dispatch({ type: "clear_filters" })}
          className="rounded text-xs font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          Quitar todos
        </button>
      )}
    </section>
  );
}
