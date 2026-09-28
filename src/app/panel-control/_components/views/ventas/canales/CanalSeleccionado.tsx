"use client";

import { Pencil } from "lucide-react";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { notifyPendingIntegration } from "@/components/panel-control/pending-integration";
import { Button } from "@/components/ui/button";
import type {
  CanalDetalle,
  CanalDetalleCostos,
  CanalDetalleKpis,
} from "@/features/panel-control/canales/models/canal-detalle.model";
import type { CanalFicha } from "@/features/panel-control/canales/models/canal-ficha.model";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import {
  COBRO_LABEL,
  ENTRADA_CHIP_LABEL,
} from "@/features/panel-control/shared/config/filter-labels.config";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";
import { ContractBlock, KpiRow } from "../ContractBlock";
import { CanalBloqueTipo } from "./CanalBloqueTipo";

type DetalleState = PanelContractState<"canales-detalle">;

function siNo(valor: boolean | null): string {
  if (valor === null) return "por confirmar";
  return valor ? "sí" : "no";
}

function porcentajeFicha(valor: number | null, pendiente: boolean): string {
  if (pendiente || valor === null) return "por confirmar";
  return formatPercent(valor, 1);
}

function FichaLinea({ ficha, verComisiones }: { ficha: CanalFicha; verComisiones: boolean }) {
  const pendiente = (campo: CanalFicha["camposPendientes"][number]) =>
    ficha.camposPendientes.includes(campo);
  const items: [string, string][] = [
    ["Familia", ficha.familia ?? "por confirmar"],
    ["Entrada", ficha.entrada ? ENTRADA_CHIP_LABEL[ficha.entrada] : "por confirmar"],
    ["Cobro", ficha.cobro ? COBRO_LABEL[ficha.cobro] : "por confirmar"],
    ["Courier", siNo(ficha.usaCourier)],
    ["Pauta general", siNo(ficha.recibePautaGeneral)],
    ["Meta mensual", ficha.metaMensual === null ? "sin meta" : formatSoles(ficha.metaMensual)],
  ];
  if (verComisiones) {
    items.push(
      ["Comisión", porcentajeFicha(ficha.comisionPct ?? null, pendiente("comisionPct"))],
      ["Pasarela", porcentajeFicha(ficha.pasarelaPct ?? null, pendiente("pasarelaPct"))],
    );
  }
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map(([termino, valor]) => (
        <div key={termino} className="flex gap-1">
          <dt className="text-pc-text-muted">{termino}:</dt>
          <dd className={valor === "por confirmar" ? "text-pc-warn" : "font-medium text-pc-text"}>
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function kpisBase(
  detalle: CanalDetalle,
  anterior: CanalDetalleKpis | null,
  origin: DataOrigin,
  abrir: (tipo: Parameters<typeof grupos.de>[0], titulo: string) => void,
) {
  const { kpis, ficha } = detalle;
  const esLead = ficha.entrada === "lead";
  const presencial = ficha.entrada === "presencial" || ficha.usaCourier === false;
  return [
    <KpiCard
      key="facturacion"
      label="Facturación"
      glosario="venta"
      value={formatSoles(kpis.facturacion)}
      origin={origin}
      delta={anterior ? calcularDelta(kpis.facturacion, anterior.facturacion) : undefined}
      sub={
        <>
          {formatPercent(kpis.participacion)} del total del periodo
          {kpis.metaPeriodo ? (
            <span className="mt-1 block">
              <ProgressBar
                logrado={kpis.facturacion}
                meta={kpis.metaPeriodo}
                etiqueta={`Avance de la meta de ${ficha.nombre}`}
              />
              {formatPercent(kpis.avanceMeta)} de la meta del periodo (
              {formatSoles(kpis.metaPeriodo)})
            </span>
          ) : (
            <span className="block">Sin meta cargada en la ficha</span>
          )}
        </>
      }
      onDrill={() => abrir("ventas", `${ficha.nombre} · ventas`)}
    />,
    <KpiCard
      key="ventas"
      label="Ventas"
      glosario="ticket"
      value={formatNumber(kpis.ventas)}
      origin={origin}
      delta={anterior ? calcularDelta(kpis.ventas, anterior.ventas) : undefined}
      sub={`Ticket ${formatSoles(kpis.ticket)} · ${formatNumber(kpis.unidades)} unidades`}
      onDrill={() => abrir("ventas", `${ficha.nombre} · ventas`)}
    />,
    esLead ? (
      <KpiCard
        key="leads"
        label="Leads"
        glosario="confirmacion"
        value={formatNumber(kpis.leads)}
        origin={origin}
        delta={anterior ? calcularDelta(kpis.leads, anterior.leads) : undefined}
        sub={`${formatPercent(kpis.confirmacion)} confirmados`}
        onDrill={() => abrir("leads", `${ficha.nombre} · leads`)}
        drillLabel="Ver leads"
      />
    ) : (
      <KpiCard
        key="unidades"
        label="Unidades"
        value={formatNumber(kpis.unidades)}
        origin={origin}
        delta={anterior ? calcularDelta(kpis.unidades, anterior.unidades) : undefined}
        sub="Canal sin etapa de lead: cada pedido entra como venta"
        onDrill={() => abrir("ventas", `${ficha.nombre} · ventas`)}
      />
    ),
    presencial ? (
      <KpiCard
        key="caja"
        label="Cobrado en caja"
        glosario="pagado"
        value={formatSoles(kpis.cobradoEnCaja)}
        origin={origin}
        sub="Venta presencial: se cobra al momento, no hay entrega por courier"
        onDrill={() => abrir("cobrado", `${ficha.nombre} · cobrado`)}
        drillLabel="Ver cobros"
      />
    ) : (
      <KpiCard
        key="efectividad"
        label="Efectividad de entrega"
        glosario="efectividad_entrega"
        value={formatPercent(kpis.efectividadEntrega)}
        origin={origin}
        delta={
          anterior ? calcularDelta(kpis.efectividadEntrega, anterior.efectividadEntrega) : undefined
        }
        sub="Entregados sobre entregados + rechazados"
        onDrill={() => abrir("entregados", `${ficha.nombre} · entregados`)}
        drillLabel="Ver entregados"
      />
    ),
  ];
}

function kpisCostos(
  costos: CanalDetalleCostos,
  nombre: string,
  origin: DataOrigin,
  abrir: (tipo: Parameters<typeof grupos.de>[0], titulo: string) => void,
) {
  return [
    <KpiCard
      key="ganancia"
      label={costos.gananciaParcial ? "Ganancia (parcial)" : "Ganancia"}
      glosario="ganancia"
      value={
        costos.gananciaParcial ? (
          <span className="text-pc-text-muted">≤ {formatSoles(costos.ganancia)}</span>
        ) : (
          formatSoles(costos.ganancia)
        )
      }
      origin={origin}
      sub={
        <>
          Margen {formatPercent(costos.margen)} · costo del canal {formatSoles(costos.costoCanal)}
          {costos.gananciaParcial && (
            <span className="block text-pc-warn">
              Hay entregas sin costo de producto cargado: la cifra es un tope, no la ganancia final.
            </span>
          )}
        </>
      }
      onDrill={() => abrir("entregados", `${nombre} · entregados`)}
      drillLabel="Ver entregados"
    />,
    <KpiCard
      key="retorno"
      label="Retorno de publicidad"
      glosario="retorno_publicidad"
      value={formatVeces(costos.retornoPublicidad)}
      origin={origin}
      sub={
        <>
          Publicidad {formatSoles(costos.publicidad)}: directa {formatSoles(costos.pautaDirecta)} ·{" "}
          <i>general estimada {formatSoles(costos.pautaGeneralEstimada)}</i>
          <span className="block">
            Comisión {formatSoles(costos.comision)} · flete {formatSoles(costos.flete)}
          </span>
          {costos.retornoPublicidad === null && (
            <span className="block">{SIN_DATO}: el canal no tiene inversión registrada</span>
          )}
        </>
      }
    />,
  ];
}

interface CanalSeleccionadoProps {
  state: DetalleState;
}

export function CanalSeleccionado({ state }: CanalSeleccionadoProps) {
  const { view, openDrilldown } = usePanel();
  const capacidades = view.access === "permitido" ? view.capabilities : new Set();
  const verCostos = capacidades.has("ver_costos");
  const verComisiones = capacidades.has("ver_comisiones");
  const puedeEditar = capacidades.has("editar_configuracion");
  const labels = [
    "Facturación",
    "Ventas",
    "Leads",
    "Efectividad de entrega",
    ...(verCostos ? ["Ganancia", "Retorno de publicidad"] : []),
  ];
  const canalId = state.data?.actual.ficha.id;
  const abrir = (tipo: Parameters<typeof grupos.de>[0], titulo: string) => {
    if (canalId) openDrilldown(grupos.de(tipo, titulo, { canal: canalId }));
  };

  return (
    <div className="space-y-3.5">
      <ContractBlock
        state={state}
        titulo={state.data ? state.data.actual.ficha.nombre : "Canal seleccionado"}
        subtitulo="Ficha de reglas del canal: define cómo se cuentan sus ventas, cobros y costos"
        skeleton="linea"
        acciones={
          puedeEditar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => notifyPendingIntegration("Editar ficha", "canales-fichas-guardar")}
            >
              <Pencil aria-hidden />
              Editar ficha
              <span className="rounded bg-pc-surface-muted px-1 text-[10px] font-bold uppercase text-pc-text-muted">
                Pendiente
              </span>
            </Button>
          )
        }
      >
        {(data) => (
          <div className="space-y-2">
            <FichaLinea ficha={data.actual.ficha} verComisiones={verComisiones} />
            {(data.actual.ficha.reglasPorConfirmar ||
              data.actual.ficha.camposPendientes.length > 0) && (
              <p
                role="note"
                className="rounded-lg bg-pc-warn-soft px-2.5 py-1.5 text-xs text-pc-warn"
              >
                Hay reglas de la ficha por confirmar. Las cifras que dependen de ellas se muestran
                con «—» o «por confirmar».
              </p>
            )}
          </div>
        )}
      </ContractBlock>
      <KpiRow
        state={state}
        labels={labels}
        titulo="Indicadores del canal"
        className={
          verCostos
            ? "grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
            : "grid grid-cols-2 gap-3 lg:grid-cols-4"
        }
      >
        {(data, origin) => {
          const anterior = data.anterior_misma_antiguedad?.kpis ?? null;
          return [
            ...kpisBase(data.actual, anterior, origin, abrir),
            ...(data.actual.costos
              ? kpisCostos(data.actual.costos, data.actual.ficha.nombre, origin, abrir)
              : []),
          ];
        }}
      </KpiRow>
      <CanalBloqueTipo state={state} />
    </div>
  );
}
