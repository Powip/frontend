"use client";

import { useMemo } from "react";
import type { DimensionFilterKey } from "../models/panel-filters.model";
import type { PanelCapability } from "../models/panel-role.model";
import { usePanel } from "../state/panel-context";
import { getActiveFilterChips } from "../utils/filter-chips";
import { formatRange } from "../utils/format";
import { usePanelOptions } from "./use-panel-options";

export interface PanelExportMeta {
  capabilities: ReadonlySet<PanelCapability>;
  periodo: string;
  filtros: string;
  desde: string;
  hasta: string;
}

const SIN_CAPACIDADES: ReadonlySet<PanelCapability> = new Set();

export function usePanelExportMeta(): PanelExportMeta {
  const { view } = usePanel();
  const options = usePanelOptions();

  return useMemo(() => {
    if (view.access !== "permitido") {
      return { capabilities: SIN_CAPACIDADES, periodo: "", filtros: "", desde: "", hasta: "" };
    }
    const bloqueados = new Set<DimensionFilterKey>(view.asesorFijo ? ["asesorId"] : []);
    const chips = getActiveFilterChips(
      view.filters,
      { tienda: options.tiendaNombre, canal: options.canalNombre, asesor: options.asesorNombre },
      bloqueados,
    );
    return {
      capabilities: view.capabilities,
      periodo: `${formatRange(view.period.desde, view.period.hasta)} ${view.period.hasta.slice(0, 4)} (hora Lima)`,
      filtros: chips.length
        ? chips.map((chip) => `${chip.label}: ${chip.value}`).join(" · ")
        : "Sin filtros",
      desde: view.period.desde,
      hasta: view.period.hasta,
    };
  }, [view, options]);
}
