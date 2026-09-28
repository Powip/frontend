"use client";

import { Download, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { rolPuedeUsarContrato } from "@/features/panel-control/shared/data/panel-autorizacion";
import { usePanelOptions } from "@/features/panel-control/shared/hooks/use-panel-options";
import type { PanelDataMode } from "@/features/panel-control/shared/models/data-origin.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { CompartirReporteDialog } from "./CompartirReporteDialog";
import { FilterSelect } from "./FilterSelect";
import { MoreFiltersPopover } from "./MoreFiltersPopover";
import { PeriodControl } from "./PeriodControl";
import { useExcelCompleto } from "./useExcelCompleto";
import { ViewAsControl } from "./ViewAsControl";

function canalPlaceholder(status: string): string | null {
  if (status === "cargando") return "Cargando canales…";
  if (status === "error") return "Canales no disponibles";
  if (status === "pendiente") return "Canales pendientes";
  if (status === "restringido") return "Sin acceso a canales";
  return null;
}

export function PanelTopBar() {
  const { state, dispatch, session, view } = usePanel();
  const options = usePanelOptions();
  const permitido = view.access === "permitido" ? view : null;
  const canales = (options.canales.data ?? []).filter((canal) => canal.activo);
  const placeholderCanal = canalPlaceholder(options.canales.status);
  const puedeCompartir =
    !!permitido &&
    rolPuedeUsarContrato("compartir-reporte", permitido.role, permitido.capabilities);
  const [compartir, setCompartir] = useState(false);
  const excel = useExcelCompleto();

  return (
    <header className="border-b border-pc-border bg-pc-card px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 min-[1100px]:flex-nowrap">
        <div className="mr-auto min-w-0 shrink-0">
          <h1 className="whitespace-nowrap text-lg font-extrabold tracking-wide text-pc-text sm:text-xl">
            PANEL DE CONTROL
          </h1>
          <p className="hidden whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.16em] text-pc-text-muted min-[1250px]:block">
            Todo el negocio · todos los canales
          </p>
        </div>
        {permitido && (
          <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0">
            <legend className="sr-only">Filtros del panel</legend>
            <FilterSelect
              label="Tienda"
              value={state.filters.tiendaId ?? ""}
              onChange={(value) =>
                dispatch({ type: "set_filter", key: "tiendaId", value: value || null })
              }
            >
              <option value="">Todas las tiendas</option>
              {session.tiendas.map((tienda) => (
                <option key={tienda.id} value={tienda.id}>
                  {tienda.nombre}
                </option>
              ))}
            </FilterSelect>
            <PeriodControl />
            <FilterSelect
              label="Canal"
              value={state.filters.canalId ?? ""}
              disabled={options.canales.status !== "listo" && !state.filters.canalId}
              hint={placeholderCanal ?? "Fichas reales de /config/canales"}
              onChange={(value) =>
                dispatch({ type: "set_filter", key: "canalId", value: value || null })
              }
            >
              <option value="">{placeholderCanal ?? "Todos los canales"}</option>
              {state.filters.canalId &&
                !canales.some((canal) => canal.id === state.filters.canalId) && (
                  <option value={state.filters.canalId}>
                    {options.canalNombre(state.filters.canalId) ?? "Canal seleccionado"}
                  </option>
                )}
              {canales.map((canal) => (
                <option key={canal.id} value={canal.id}>
                  {canal.nombre}
                </option>
              ))}
            </FilterSelect>
            <MoreFiltersPopover />
            <ViewAsControl />
            <FilterSelect
              label="Datos"
              value={state.dataMode}
              hint="«Reales + demo» muestra las vistas sin contrato con datos demo marcados"
              onChange={(value) =>
                dispatch({ type: "set_data_mode", mode: value as PanelDataMode })
              }
            >
              <option value="mixto">Datos: reales + demo</option>
              <option value="solo_real">Datos: solo reales</option>
            </FilterSelect>
            {puedeCompartir && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-pc-border bg-pc-card text-pc-text"
                aria-label="Compartir reporte"
                onClick={() => setCompartir(true)}
              >
                <Share2 aria-hidden />
                <span className="hidden min-[1640px]:inline">Compartir</span>
              </Button>
            )}
            {excel.permitido && (
              <Button
                type="button"
                size="sm"
                className="bg-pc-primary text-white hover:bg-pc-primary-strong"
                aria-label={
                  excel.descargando ? "Generando Excel completo" : "Descargar Excel completo"
                }
                disabled={excel.descargando}
                onClick={() => void excel.descargar()}
              >
                <Download aria-hidden />
                <span className="hidden min-[1640px]:inline">
                  {excel.descargando ? "Generando…" : "Excel"}
                </span>
              </Button>
            )}
          </fieldset>
        )}
        {puedeCompartir && (
          <CompartirReporteDialog abierto={compartir} onAbiertoChange={setCompartir} />
        )}
      </div>
    </header>
  );
}
