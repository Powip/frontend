"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { SegmentedControl } from "@/components/panel-control/SegmentedControl";
import type { GrupoDetalleTipo } from "@/features/panel-control/detalle/models/detalle.model";
import type {
  AgrupacionEquipo,
  ModoUpsell,
  VendedoraMetricas,
} from "@/features/panel-control/equipo/models/equipo.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { SIN_ASESOR } from "@/features/panel-control/shared/models/panel-filters.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { ContractBlock, KpiRow } from "../ventas/ContractBlock";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";

type Campo = keyof VendedoraMetricas;

interface Columna {
  id: Campo;
  header: string;
  bloque: string;
  formato: "numero" | "soles" | "porcentaje";
  drill?: { tipo: GrupoDetalleTipo; titulo: string; extra?: Record<string, string> };
}

const COLUMNAS: Columna[] = [
  {
    id: "pedidos",
    header: "Pedidos",
    bloque: "Volumen",
    formato: "numero",
    drill: { tipo: "ventas", titulo: "ventas" },
  },
  { id: "participacion", header: "% part.", bloque: "Volumen", formato: "porcentaje" },
  {
    id: "entregados",
    header: "Entregados",
    bloque: "Volumen",
    formato: "numero",
    drill: { tipo: "entregados", titulo: "entregados" },
  },
  { id: "efectividadEntrega", header: "% entrega", bloque: "Volumen", formato: "porcentaje" },
  {
    id: "pagado",
    header: "Pagado",
    bloque: "Cobranza",
    formato: "soles",
    drill: { tipo: "cobrado", titulo: "pagado" },
  },
  {
    id: "pendiente",
    header: "Pendiente",
    bloque: "Cobranza",
    formato: "soles",
    drill: { tipo: "no_cobrado", titulo: "pendiente" },
  },
  {
    id: "perdido",
    header: "Perdido",
    bloque: "Cobranza",
    formato: "soles",
    drill: { tipo: "rechazados", titulo: "perdido" },
  },
  { id: "total", header: "Total", bloque: "Cobranza", formato: "soles" },
  { id: "porcentajePagado", header: "% pagado", bloque: "Cobranza", formato: "porcentaje" },
  { id: "upsellPagado", header: "Pagado", bloque: "Upsell", formato: "soles" },
  {
    id: "conUpsell",
    header: "N°",
    bloque: "Upsell",
    formato: "numero",
    drill: { tipo: "con_upsell", titulo: "con upsell" },
  },
  { id: "tasaUpsell", header: "%", bloque: "Upsell", formato: "porcentaje" },
  { id: "entregaConUpsell", header: "% entrega", bloque: "Upsell", formato: "porcentaje" },
  { id: "ticketEntregado", header: "Entregado ÷ entregas", bloque: "Ticket", formato: "soles" },
  { id: "metaPeriodo", header: "Del periodo", bloque: "Meta", formato: "soles" },
  { id: "avanceMeta", header: "Avance", bloque: "Meta", formato: "porcentaje" },
];

const COMISION: Columna = {
  id: "comisionEstimada",
  header: "Estimada",
  bloque: "Comisión",
  formato: "soles",
};

function formatear(valor: number | undefined | null, formato: Columna["formato"]): string {
  if (formato === "soles") return formatSoles(valor);
  if (formato === "porcentaje") return formatPercent(valor);
  return formatNumber(valor);
}

export function VendedorasSubtab() {
  const { view, openDrilldown } = usePanel();
  const verComisiones = view.access === "permitido" && view.capabilities.has("ver_comisiones");
  const [agrupar, setAgrupar] = useState<AgrupacionEquipo>("zona");
  const [upsell, setUpsell] = useState<ModoUpsell>("con");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [orden, setOrden] = useState<{ id: Campo; desc: boolean } | null>(null);
  const state = usePanelContract(
    "equipo-vendedoras",
    view.access === "permitido" ? { ...view.query, agrupar, upsell } : null,
  );
  const columnas = verComisiones ? [...COLUMNAS, COMISION] : COLUMNAS;
  const bloques = columnas.reduce<{ bloque: string; span: number }[]>((lista, columna) => {
    const ultimo = lista[lista.length - 1];
    if (ultimo?.bloque === columna.bloque) ultimo.span += 1;
    else lista.push({ bloque: columna.bloque, span: 1 });
    return lista;
  }, []);

  const celda = (
    metricas: VendedoraMetricas,
    columna: Columna,
    params: Record<string, string>,
    etiqueta: string,
  ): ReactNode => {
    const valor = metricas[columna.id] as number | null | undefined;
    const texto = formatear(valor, columna.formato);
    if (!columna.drill || !valor) return texto;
    const drill = columna.drill;
    return (
      <button
        type="button"
        onClick={() =>
          openDrilldown(
            grupos.de(drill.tipo, `${etiqueta} · ${drill.titulo}`, {
              entrada_no: "lead",
              ...params,
            }),
          )
        }
        aria-label={`${etiqueta}: ${texto} ${columna.header.toLowerCase()} (${columna.bloque}). Ver pedidos`}
        className="rounded font-semibold tabular-nums text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
      >
        {texto}
      </button>
    );
  };

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Agrupar"
          value={agrupar}
          onChange={(valor) => {
            setAgrupar(valor);
            setAbiertos(new Set());
          }}
          options={[
            { value: "zona", label: "Zona → Asesora" },
            { value: "asesora", label: "Asesora → Zona" },
          ]}
        />
        <SegmentedControl
          ariaLabel="Montos con o sin upsell"
          value={upsell}
          onChange={setUpsell}
          options={[
            { value: "con", label: "Con upsell" },
            { value: "sin", label: "Sin upsell" },
          ]}
        />
      </div>
      <KpiRow
        state={state}
        labels={["Pagado", "Pendiente", "Perdido", "Total", "Ventas", "Upsell"]}
        titulo="Indicadores del equipo de ventas"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
      >
        {(data, origin) => {
          const k = data.actual.kpis;
          const a = data.anterior_misma_antiguedad?.kpis;
          const abrir = (tipo: GrupoDetalleTipo, titulo: string) => () =>
            openDrilldown(grupos.de(tipo, titulo, { entrada_no: "lead" }));
          return [
            <KpiCard
              key="pagado"
              label="Pagado"
              glosario="pagado"
              value={formatSoles(k.pagado)}
              origin={origin}
              delta={a ? calcularDelta(k.pagado, a.pagado) : undefined}
              onDrill={abrir("cobrado", "Ventas directas y POS pagadas")}
            />,
            <KpiCard
              key="pendiente"
              label="Pendiente"
              value={formatSoles(k.pendiente)}
              origin={origin}
              sub={`En curso ${formatSoles(k.enCurso)} · por liquidar ${formatSoles(k.porLiquidar)}`}
              onDrill={abrir("no_cobrado", "Ventas directas y POS pendientes")}
            />,
            <KpiCard
              key="perdido"
              label="Perdido"
              glosario="perdido"
              value={formatSoles(k.perdido)}
              origin={origin}
              onDrill={abrir("rechazados", "Ventas directas rechazadas")}
            />,
            <KpiCard
              key="total"
              label="Total"
              value={formatSoles(k.total)}
              origin={origin}
              sub="Pagado + pendiente + perdido"
            />,
            <KpiCard
              key="ventas"
              label="Ventas"
              value={formatNumber(k.ventas)}
              origin={origin}
              delta={a ? calcularDelta(k.ventas, a.ventas) : undefined}
              onDrill={abrir("ventas", "Ventas directas y POS con asesora")}
            />,
            <KpiCard
              key="upsell"
              label="Upsell"
              glosario="upsell"
              value={formatSoles(k.upsell)}
              origin={origin}
              onDrill={abrir("con_upsell", "Ventas directas con upsell")}
            />,
          ];
        }}
      </KpiRow>
      <ContractBlock
        state={state}
        titulo="Vendedoras y caja"
        subtitulo={`Formato del Excel del negocio. Ventas directas y POS con asesora; los leads confirmados se cuentan en Confirmadoras. Montos ${upsell === "con" ? "con" : "sin"} el upsell.`}
      >
        {(data) => {
          const filas = orden
            ? [...data.actual.grupos].sort((a, b) => {
                const va = (a.metricas[orden.id] as number | null | undefined) ?? -Infinity;
                const vb = (b.metricas[orden.id] as number | null | undefined) ?? -Infinity;
                return orden.desc ? vb - va : va - vb;
              })
            : data.actual.grupos;
          const paramsGrupo = (clave: string, asesorId: string | null): Record<string, string> =>
            agrupar === "zona" ? { zona: clave } : { asesor: asesorId ?? SIN_ASESOR };
          const paramsHijo = (clave: string, asesorId: string | null): Record<string, string> => {
            const [primero, segundo] = clave.split("|");
            return agrupar === "zona"
              ? { zona: primero, asesor: asesorId ?? SIN_ASESOR }
              : { asesor: primero, zona: segundo };
          };
          return (
            <div className="space-y-2">
              <div className="overflow-auto rounded-xl border border-pc-border-soft">
                <table className="w-full border-collapse text-[12.5px]">
                  <caption className="sr-only">Vendedoras y caja</caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        rowSpan={2}
                        className="left-0 z-[3] border-b border-pc-border bg-pc-surface-muted px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted sm:sticky"
                      >
                        {agrupar === "zona" ? "Zona / asesora" : "Asesora / zona"}
                      </th>
                      {bloques.map((bloque) => (
                        <th
                          key={bloque.bloque}
                          scope="colgroup"
                          colSpan={bloque.span}
                          className="border-b border-l border-pc-border-soft bg-pc-surface-muted px-2.5 py-1 text-center text-[10.5px] font-bold uppercase tracking-wide text-pc-text"
                        >
                          {bloque.bloque}
                          {bloque.bloque === "Comisión" && "*"}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {columnas.map((columna) => {
                        const activo = orden?.id === columna.id;
                        return (
                          <th
                            key={columna.id}
                            scope="col"
                            aria-sort={activo ? (orden.desc ? "descending" : "ascending") : "none"}
                            className="whitespace-nowrap border-b border-pc-border bg-pc-surface-muted px-2.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOrden((actual) =>
                                  actual?.id === columna.id
                                    ? { id: columna.id, desc: !actual.desc }
                                    : { id: columna.id, desc: true },
                                )
                              }
                              className="rounded uppercase outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
                            >
                              {columna.header}
                              <span aria-hidden className="ml-0.5 text-pc-primary">
                                {activo ? (orden.desc ? "▼" : "▲") : ""}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((grupo) => {
                      const abierto = abiertos.has(grupo.clave);
                      const params = paramsGrupo(grupo.clave, grupo.asesorId);
                      return (
                        <Fragment key={grupo.clave}>
                          <tr className="bg-pc-card font-semibold hover:bg-pc-surface-muted/60">
                            <th
                              scope="row"
                              className="left-0 z-[1] whitespace-nowrap border-b border-pc-border-soft bg-pc-card px-2.5 py-2 text-left sm:sticky"
                            >
                              <button
                                type="button"
                                aria-expanded={abierto}
                                onClick={() =>
                                  setAbiertos((actual) => {
                                    const siguiente = new Set(actual);
                                    if (siguiente.has(grupo.clave)) siguiente.delete(grupo.clave);
                                    else siguiente.add(grupo.clave);
                                    return siguiente;
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
                              >
                                <ChevronRight
                                  aria-hidden
                                  className={cn(
                                    "size-3.5 transition-transform",
                                    abierto && "rotate-90",
                                  )}
                                />
                                {grupo.etiqueta}
                                {grupo.rol === "caja" && (
                                  <span className="rounded bg-pc-info-soft px-1 text-[10px] font-bold uppercase text-pc-info">
                                    Caja
                                  </span>
                                )}
                              </button>
                            </th>
                            {columnas.map((columna) => (
                              <td
                                key={columna.id}
                                className="whitespace-nowrap border-b border-pc-border-soft px-2.5 py-2 text-right tabular-nums"
                              >
                                {celda(grupo.metricas, columna, params, grupo.etiqueta)}
                              </td>
                            ))}
                          </tr>
                          {abierto &&
                            grupo.hijos.map((hijo) => (
                              <tr key={hijo.clave} className="bg-pc-surface-muted/40">
                                <th
                                  scope="row"
                                  className="left-0 z-[1] whitespace-nowrap border-b border-pc-border-soft bg-pc-surface-muted px-2.5 py-1.5 pl-8 text-left font-normal sm:sticky"
                                >
                                  {hijo.etiqueta}
                                </th>
                                {columnas.map((columna) => (
                                  <td
                                    key={columna.id}
                                    className="whitespace-nowrap border-b border-pc-border-soft px-2.5 py-1.5 text-right tabular-nums"
                                  >
                                    {celda(
                                      hijo.metricas,
                                      columna,
                                      paramsHijo(hijo.clave, hijo.asesorId),
                                      `${grupo.etiqueta} · ${hijo.etiqueta}`,
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th
                        scope="row"
                        className="left-0 border-t border-pc-border bg-pc-surface-muted px-2.5 py-2 text-left font-bold sm:sticky"
                      >
                        Total
                      </th>
                      {columnas.map((columna) => (
                        <td
                          key={columna.id}
                          className="whitespace-nowrap border-t border-pc-border bg-pc-surface-muted px-2.5 py-2 text-right font-bold tabular-nums"
                        >
                          {formatear(
                            data.actual.total[columna.id] as number | null | undefined,
                            columna.formato,
                          )}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-pc-text-muted">
                Ventas automáticas (web y marketplace, sin asesora):{" "}
                <button
                  type="button"
                  onClick={() =>
                    openDrilldown(
                      grupos.de("ventas", "Ventas automáticas", {
                        asesor: SIN_ASESOR,
                        entrada_no: "lead",
                      }),
                    )
                  }
                  className="rounded font-semibold text-pc-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-pc-primary"
                >
                  {formatNumber(data.actual.automaticas.ventas)} ventas ·{" "}
                  {formatSoles(data.actual.automaticas.facturacion)}
                </button>{" "}
                · van aparte y fuera de comisiones.
                {verComisiones &&
                  " * Comisión de ejemplo (configurable): 3 % de lo pagado + 10 % del upsell pagado."}
              </p>
            </div>
          );
        }}
      </ContractBlock>
    </div>
  );
}
