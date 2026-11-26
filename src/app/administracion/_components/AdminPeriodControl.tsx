"use client";

import { useId, useState } from "react";
import { FilterSelect } from "@/app/panel-control/_components/shell/FilterSelect";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  esDiaKey,
  hoyLima,
  PRESETS_PERIODO,
  type PresetPeriodo,
  presetDeRango,
  rangoDePreset,
} from "../_lib/periodo";

/** Periodo de todo el módulo, con el mismo aspecto que el del Panel de control. */
export function AdminPeriodControl() {
  const { fromDate, toDate, setPeriod } = useAdminPeriod();
  const desdeId = useId();
  const hastaId = useId();
  const hoy = hoyLima();
  const [forzarPersonalizado, setForzarPersonalizado] = useState(false);
  const derivado = presetDeRango(fromDate, toDate, hoy);
  const preset: PresetPeriodo = forzarPersonalizado ? "personalizado" : derivado;

  const cambiarPreset = (valor: string) => {
    const nuevo = valor as PresetPeriodo;
    if (nuevo === "personalizado") {
      setForzarPersonalizado(true);
      return;
    }
    setForzarPersonalizado(false);
    const rango = rangoDePreset(nuevo, hoy);
    setPeriod(rango.desde, rango.hasta);
  };

  const cambiarFecha = (campo: "desde" | "hasta", valor: string) => {
    if (!esDiaKey(valor)) return;
    setForzarPersonalizado(true);
    const desde = campo === "desde" ? valor : fromDate;
    const hasta = campo === "hasta" ? valor : toDate;
    if (desde > hasta) {
      setPeriod(valor, valor);
      return;
    }
    setPeriod(desde, hasta);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterSelect label="Periodo" value={preset} onChange={cambiarPreset} compactLabel={false}>
        {PRESETS_PERIODO.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.label}
          </option>
        ))}
      </FilterSelect>
      {preset === "personalizado" && (
        <div className="flex items-center gap-1.5 rounded-lg border border-pc-border bg-pc-card px-2.5 py-1 focus-within:ring-2 focus-within:ring-pc-primary">
          <label htmlFor={desdeId} className="text-[10px] font-semibold uppercase text-pc-text-soft">
            Desde
          </label>
          <input
            id={desdeId}
            type="date"
            value={fromDate}
            max={hoy}
            onChange={(event) => cambiarFecha("desde", event.target.value)}
            className="bg-transparent text-xs text-pc-text outline-none dark:[color-scheme:dark]"
          />
          <label htmlFor={hastaId} className="text-[10px] font-semibold uppercase text-pc-text-soft">
            Hasta
          </label>
          <input
            id={hastaId}
            type="date"
            value={toDate}
            onChange={(event) => cambiarFecha("hasta", event.target.value)}
            className="bg-transparent text-xs text-pc-text outline-none dark:[color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
}
