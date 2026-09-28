"use client";

import type { ReactNode } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { DataOriginBadge } from "@/components/panel-control/DataOriginBadge";
import type { DetalleGrupo } from "@/features/panel-control/detalle/models/detalle.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { cuadresResumen } from "@/features/panel-control/resumen/utils/cuadres-resumen";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import {
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import type { ResumenState } from "./ResumenBlock";

type Tono = "lead" | "directa" | "principal" | "bueno" | "perdida";

const BORDE: Record<Tono, string> = {
  lead: "border-l-[var(--pc-series-2)]",
  directa: "border-l-pc-primary",
  principal: "border-l-[var(--pc-series-1)]",
  bueno: "border-l-pc-ok",
  perdida: "border-l-pc-bad bg-pc-bad-soft/30",
};

interface NodoProps {
  tono: Tono;
  titulo: string;
  estadoPowip: string;
  valor: string;
  grupo: DetalleGrupo;
  children?: ReactNode;
  className?: string;
}

function Nodo({ tono, titulo, estadoPowip, valor, grupo, children, className }: NodoProps) {
  const { openDrilldown } = usePanel();
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-l-4 border-pc-border bg-pc-card px-3 py-2.5",
        BORDE[tono],
        className,
      )}
    >
      <button
        type="button"
        onClick={() => openDrilldown(grupo)}
        aria-label={`${titulo}: ${valor}. Ver pedidos`}
        className="w-full rounded text-left outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
      >
        <span className="block text-[10.5px] font-bold uppercase tracking-wide text-pc-text-muted">
          {titulo}
        </span>
        <span className="block text-[9.5px] font-semibold text-pc-text-soft">
          Estado POWIP: {estadoPowip}
        </span>
        <span className="mt-0.5 block text-lg font-bold tabular-nums text-pc-text">{valor}</span>
      </button>
      {children && (
        <div className="text-[11.5px] leading-relaxed text-pc-text-muted">{children}</div>
      )}
    </div>
  );
}

function SubBoton({ grupo, children }: { grupo: DetalleGrupo; children: ReactNode }) {
  const { openDrilldown } = usePanel();
  return (
    <button
      type="button"
      onClick={() => openDrilldown(grupo)}
      className="rounded underline decoration-dotted outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
    >
      {children}
    </button>
  );
}

const Flecha = ({ texto = "→", className }: { texto?: string; className?: string }) => (
  <span
    aria-hidden
    className={cn(
      "hidden self-center text-center text-lg font-bold text-pc-border lg:block",
      className,
    )}
  >
    {texto}
  </span>
);

export function FlujoPedidos({ state }: { state: ResumenState }) {
  return (
    <details className="group rounded-2xl border border-pc-border bg-pc-card p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded text-sm font-semibold text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-pc-primary transition-transform group-open:rotate-90">
          ▸
        </span>
        Flujo de pedidos · de lead a dinero cobrado
        {state.status !== "cargando" && <DataOriginBadge origin={state.origin} />}
      </summary>
      <p className="mt-2 text-xs text-pc-text-muted">
        Los leads se confirman antes de ser venta; las ventas directas y el POS entran directo.
        Entrega y cobro son dimensiones distintas: un prepago cobrado aún no entregado cuenta en
        Cobrado, no en Entregados. Clic en cualquier caja para ver sus pedidos.
      </p>
      <div className="mt-3">
        <ContractView state={state} label="flujo de pedidos" skeleton="grafico">
          {(data) => {
            const { flujo, vendi, meDeben } = data.actual;
            const cuadres = cuadresResumen(data.actual);
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[1fr_24px_1.1fr_24px_1fr_24px_1fr_24px_1fr] lg:grid-rows-2">
                  <Nodo
                    tono="lead"
                    titulo="Leads"
                    estadoPowip="Pendiente"
                    valor={formatNumber(flujo.leads)}
                    grupo={grupos.leads()}
                    className="lg:col-start-1 lg:row-start-1"
                  >
                    <SubBoton grupo={grupos.leadsAbiertos()}>
                      {formatNumber(flujo.leadsAbiertos)} aún sin cerrar
                    </SubBoton>
                    {" · "}
                    <SubBoton grupo={grupos.leadsAnulados()}>
                      <span className="text-pc-bad">
                        {formatNumber(flujo.leadsAnulados)} anulados
                      </span>
                    </SubBoton>
                  </Nodo>
                  <Flecha className="lg:col-start-2 lg:row-start-1" />
                  <Nodo
                    tono="directa"
                    titulo="Directas + POS"
                    estadoPowip="entran en Llamado"
                    valor={formatNumber(flujo.directasYPos)}
                    grupo={grupos.directasPos()}
                    className="lg:col-start-1 lg:row-start-2"
                  >
                    Ya cerradas por la vendedora o en caja
                  </Nodo>
                  <Flecha className="lg:col-start-2 lg:row-start-2" />
                  <Nodo
                    tono="principal"
                    titulo="Ventas"
                    estadoPowip="Llamado o más"
                    valor={formatNumber(flujo.ventas)}
                    grupo={grupos.ventas()}
                    className="lg:col-start-3 lg:row-span-2 lg:row-start-1"
                  >
                    <b className="text-sm text-pc-text">{formatSoles(flujo.facturacion)}</b>
                    <br />
                    {formatNumber(flujo.confirmados)} de leads (conf.{" "}
                    {formatPercent(flujo.confirmacion)}) +{" "}
                    {formatNumber(flujo.ventas - flujo.confirmados)} directas
                  </Nodo>
                  <Flecha className="lg:col-start-4 lg:row-span-2 lg:row-start-1" />
                  <Nodo
                    tono="principal"
                    titulo="En curso"
                    estadoPowip="Llamado → En envío"
                    valor={formatNumber(flujo.enCurso.pedidos)}
                    grupo={grupos.enCurso()}
                    className="lg:col-start-5 lg:row-span-2 lg:row-start-1"
                  >
                    {formatSoles(flujo.enCurso.monto)}
                    <br />
                    Por despachar {formatNumber(flujo.enCurso.porDespachar)} · en envío{" "}
                    {formatNumber(flujo.enCurso.enEnvio)}
                  </Nodo>
                  <Flecha className="lg:col-start-6 lg:row-start-1" />
                  <Flecha texto={"2198FE0E"} className="lg:col-start-6 lg:row-start-2" />
                  <Nodo
                    tono="bueno"
                    titulo="Entregados"
                    estadoPowip="Entregado + Pagado (entregado)"
                    valor={formatNumber(flujo.entregados.pedidos)}
                    grupo={grupos.entregados()}
                    className="lg:col-start-7 lg:row-start-1"
                  >
                    {formatSoles(flujo.entregados.monto)} · efectividad{" "}
                    {formatPercent(flujo.entregados.efectividad)}
                  </Nodo>
                  <Nodo
                    tono="perdida"
                    titulo="Rechazados"
                    estadoPowip="Rechazado"
                    valor={formatNumber(flujo.rechazados.pedidos)}
                    grupo={grupos.rechazados()}
                    className="lg:col-start-7 lg:row-start-2"
                  >
                    {formatSoles(flujo.rechazados.perdido)} perdido
                    {flujo.rechazados.flete !== undefined &&
                      ` + ${formatSoles(flujo.rechazados.flete)} de flete`}
                  </Nodo>
                  <Flecha className="lg:col-start-8 lg:row-start-1" />
                  <Nodo
                    tono="bueno"
                    titulo="Cobrado"
                    estadoPowip="cobro recibido"
                    valor={formatSoles(flujo.cobro.cobradoTotal)}
                    grupo={grupos.cobrado()}
                    className="lg:col-start-9 lg:row-start-1"
                  >
                    De entregados {formatSoles(flujo.cobro.cobradoEntregado)}
                    <br />
                    <SubBoton grupo={grupos.cobradoSinEntregar()}>
                      Prepagos sin entregar {formatSoles(flujo.cobro.cobradoSinEntregar)}
                    </SubBoton>
                  </Nodo>
                  <Nodo
                    tono="principal"
                    titulo="Por liquidar"
                    estadoPowip="Entregado sin liquidar"
                    valor={formatSoles(flujo.cobro.porLiquidar)}
                    grupo={grupos.porLiquidar()}
                    className="lg:col-start-9 lg:row-start-2"
                  >
                    <span className="text-pc-bad">{formatSoles(flujo.cobro.vencido)} vencido</span>
                  </Nodo>
                </div>
                <p className="text-[11.5px] text-pc-text-muted">
                  Cuadre: Ventas {formatSoles(vendi.facturacion)} = Entregados + En curso +
                  Rechazados{" "}
                  {cuadres.flujo ? (
                    <b className="text-pc-ok">✓</b>
                  ) : (
                    <b className="text-pc-bad">✕ no cuadra</b>
                  )}{" "}
                  · Cobrado + Por liquidar + En curso por cobrar (
                  {formatSoles(meDeben.enCursoPorCobrar)}) + Perdido{" "}
                  {cuadres.cobranza ? (
                    <b className="text-pc-ok">✓</b>
                  ) : (
                    <b className="text-pc-bad">✕ no cuadra</b>
                  )}
                </p>
              </div>
            );
          }}
        </ContractView>
      </div>
    </details>
  );
}
