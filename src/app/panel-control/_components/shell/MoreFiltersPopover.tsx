"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  COBRO_LABEL,
  ENTRADA_LABEL,
  TURNO_LABEL,
  ZONA_LABEL,
} from "@/features/panel-control/shared/config/filter-labels.config";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import {
  COBROS_CANAL,
  type DimensionFilterKey,
  ENTRADAS_CANAL,
  SIN_ASESOR,
  TURNOS_PANEL,
  ZONAS_PANEL,
} from "@/features/panel-control/shared/models/panel-filters.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { MORE_FILTER_KEYS } from "@/features/panel-control/shared/utils/filter-chips";

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  help?: string;
}

function Field({ label, value, onChange, disabled, children, help }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[10.5px] font-bold uppercase tracking-wide text-pc-text-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-pc-border bg-pc-card px-2.5 text-xs text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary disabled:bg-pc-surface-muted disabled:text-pc-text-soft"
      >
        {children}
      </select>
      {help && <small className="text-[10.5px] text-pc-text-soft">{help}</small>}
    </div>
  );
}

export function MoreFiltersPopover() {
  const { state, dispatch, view } = usePanel();
  const options = usePanelOptions();
  const [open, setOpen] = useState(false);
  if (view.access !== "permitido") return null;

  const asesorBloqueado = !!view.asesorFijo || view.requiereAsesorPreview;
  const puedeElegirAsesor = view.capabilities.has("elegir_asesor");
  const activos = MORE_FILTER_KEYS.filter(
    (key) => view.filters[key] && !(key === "asesorId" && asesorBloqueado),
  ).length;

  const set = (key: DimensionFilterKey) => (value: string) =>
    dispatch({ type: "set_filter", key, value: value || null });

  const asesoresTexto =
    options.asesores.status === "cargando"
      ? "Cargando asesoras…"
      : options.asesores.status === "error"
        ? "No se pudo cargar la lista"
        : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-pc-border bg-pc-card text-pc-text"
        >
          <SlidersHorizontal aria-hidden />
          <span>Más filtros</span>
          {activos > 0 && (
            <span className="rounded-full bg-pc-primary px-1.5 text-[11px] text-white">
              {activos}
              <span className="sr-only"> activos</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(540px,94vw)] border-pc-border bg-pc-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="¿Cómo entra el pedido?"
            value={state.filters.entrada ?? ""}
            onChange={set("entrada")}
          >
            <option value="">Todas</option>
            {ENTRADAS_CANAL.map((value) => (
              <option key={value} value={value}>
                {ENTRADA_LABEL[value]}
              </option>
            ))}
          </Field>
          <Field label="¿Cómo se cobra?" value={state.filters.cobro ?? ""} onChange={set("cobro")}>
            <option value="">Todos</option>
            {COBROS_CANAL.map((value) => (
              <option key={value} value={value}>
                {COBRO_LABEL[value]}
              </option>
            ))}
          </Field>
          <Field label="Zona" value={state.filters.zona ?? ""} onChange={set("zona")}>
            <option value="">Todas</option>
            {ZONAS_PANEL.map((value) => (
              <option key={value} value={value}>
                {ZONA_LABEL[value]}
              </option>
            ))}
          </Field>
          <Field
            label="Turno de entrega"
            value={state.filters.turno ?? ""}
            onChange={set("turno")}
            help="Pendiente de contrato: el pedido no guarda el turno Express/General"
          >
            <option value="">Todos</option>
            {TURNOS_PANEL.map((value) => (
              <option key={value} value={value}>
                {TURNO_LABEL[value]}
              </option>
            ))}
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Asesor(a)"
              value={asesorBloqueado ? (view.asesorFijo ?? "") : (state.filters.asesorId ?? "")}
              onChange={set("asesorId")}
              disabled={
                asesorBloqueado || !puedeElegirAsesor || options.asesores.status !== "listo"
              }
              help={
                asesorBloqueado
                  ? "Fijo según el rol"
                  : (asesoresTexto ?? "Lista real de ms-ventas (vendedores de la empresa)")
              }
            >
              <option value="">Todos</option>
              <option value={SIN_ASESOR}>Sin asesora (automático)</option>
              {view.asesorFijo && (
                <option value={view.asesorFijo}>
                  {options.asesorNombre(view.asesorFijo) ?? "Yo"}
                </option>
              )}
              {(options.asesores.data ?? [])
                .filter((asesor) => asesor.id !== view.asesorFijo)
                .map((asesor) => (
                  <option key={asesor.id} value={asesor.id}>
                    {asesor.nombre}
                  </option>
                ))}
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-pc-primary"
            onClick={() => dispatch({ type: "clear_filters", keep: ["tiendaId", "canalId"] })}
          >
            Limpiar estos filtros
          </Button>
          <div className="grow" />
          <Button
            type="button"
            size="sm"
            className="bg-pc-primary hover:bg-pc-primary-strong"
            onClick={() => setOpen(false)}
          >
            Listo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
