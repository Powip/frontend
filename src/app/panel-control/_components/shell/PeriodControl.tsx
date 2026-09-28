"use client";

import { useId } from "react";
import { PERIOD_PRESET_LABEL } from "@/features/panel-control/shared/config/filter-labels.config";
import {
  PERIOD_PRESETS,
  type PeriodPreset,
} from "@/features/panel-control/shared/models/panel-filters.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { isValidDayKey, startOfMonthKey } from "@/features/panel-control/shared/utils/lima-time";
import { FilterSelect } from "./FilterSelect";

export function PeriodControl() {
  const { state, dispatch, view } = usePanel();
  const desdeId = useId();
  const hastaId = useId();
  const hoy = view.access === "permitido" ? view.period.hoy : "";
  const { preset, personalizado } = state.filters.periodo;

  const cambiarPreset = (value: string) => {
    const nuevo = value as PeriodPreset;
    dispatch({
      type: "set_period",
      periodo: {
        preset: nuevo,
        personalizado:
          nuevo === "personalizado"
            ? (personalizado ?? { desde: startOfMonthKey(hoy), hasta: hoy })
            : null,
      },
    });
  };

  const cambiarFecha = (campo: "desde" | "hasta", value: string) => {
    if (!isValidDayKey(value)) return;
    const base = personalizado ?? { desde: startOfMonthKey(hoy), hasta: hoy };
    dispatch({
      type: "set_period",
      periodo: { preset: "personalizado", personalizado: { ...base, [campo]: value } },
    });
  };

  const rango = view.access === "permitido" ? view.period : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterSelect label="Periodo" value={preset} onChange={cambiarPreset}>
        {PERIOD_PRESETS.map((option) => (
          <option key={option} value={option}>
            {PERIOD_PRESET_LABEL[option]}
          </option>
        ))}
      </FilterSelect>
      {preset === "personalizado" && rango && (
        <div className="flex items-center gap-1.5 rounded-lg border border-pc-border bg-pc-card px-2.5 py-1 focus-within:ring-2 focus-within:ring-pc-primary">
          <label
            htmlFor={desdeId}
            className="text-[10px] font-semibold uppercase text-pc-text-soft"
          >
            Desde
          </label>
          <input
            id={desdeId}
            type="date"
            value={rango.desde}
            max={hoy}
            onChange={(event) => cambiarFecha("desde", event.target.value)}
            className="bg-transparent text-xs text-pc-text outline-none"
          />
          <label
            htmlFor={hastaId}
            className="text-[10px] font-semibold uppercase text-pc-text-soft"
          >
            Hasta
          </label>
          <input
            id={hastaId}
            type="date"
            value={rango.hasta}
            max={hoy}
            onChange={(event) => cambiarFecha("hasta", event.target.value)}
            className="bg-transparent text-xs text-pc-text outline-none"
          />
        </div>
      )}
    </div>
  );
}
