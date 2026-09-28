"use client";

import type { ReactNode } from "react";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { Button } from "@/components/ui/button";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import {
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import type { ResumenState } from "./ResumenBlock";

interface ResumenHeroProps {
  state: ResumenState;
  onVerTareas: () => void;
}

function Estado({ state }: { state: ResumenState }): ReactNode {
  if (state.status === "error") {
    return (
      <span role="alert" className="text-pc-bad">
        No se pudo cargar.{" "}
        <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={state.refetch}>
          Reintentar
        </Button>
      </span>
    );
  }
  if (state.status === "restringido") return "Tu rol no tiene acceso a esta cifra.";
  return `Pendiente de integración: ${state.origin.endpoint}`;
}

export function ResumenHero({ state, onVerTareas }: ResumenHeroProps) {
  const { view, openDrilldown } = usePanel();
  const verCostos = view.access === "permitido" && view.capabilities.has("ver_costos");
  const cargando = state.status === "cargando";
  const data = state.status === "listo" ? state.data : undefined;
  const actual = data?.actual;
  const anterior = data?.anterior_misma_antiguedad ?? null;
  const origin = state.status === "cargando" ? undefined : state.origin;
  const clase = "min-h-[150px]";

  if (!actual) {
    const labels = ["Vendí", verCostos ? "Gané" : "Entregado", "Me deben", "Por hacer hoy"];
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {labels.map((label) => (
          <KpiCard
            key={label}
            label={label}
            value="—"
            loading={cargando}
            origin={origin}
            sub={<Estado state={state} />}
            className={clase}
            destacado
          />
        ))}
      </div>
    );
  }

  const { vendi, gane, entregado, meDeben, acciones } = actual;
  const pedidosEsperando = acciones.reduce((total, accion) => total + accion.pedidos, 0);
  const urgentes = acciones.filter((accion) => accion.urgencia === "alta").length;

  const segunda = verCostos ? (
    gane ? (
      <KpiCard
        label={gane.entregasSinCosto > 0 ? "Gané (parcial)" : "Gané"}
        glosario="ganancia"
        value={
          gane.entregasSinCosto > 0 ? (
            <span className="text-pc-text-muted">≤ {formatSoles(gane.ganancia)}</span>
          ) : (
            formatSoles(gane.ganancia)
          )
        }
        destacado
        origin={origin}
        className={clase}
        delta={
          anterior?.gane && gane.entregasSinCosto === 0
            ? calcularDelta(gane.ganancia, anterior.gane.ganancia)
            : undefined
        }
        sub={
          <>
            Sobre lo entregado ({formatSoles(gane.entregado)})
            <br />
            Margen {gane.entregasSinCosto > 0 ? "≤ " : ""}
            {formatPercent(gane.margen)} · publicidad {formatSoles(gane.publicidad)}
            {gane.entregasSinCosto > 0 && (
              <>
                <br />
                <span className="text-pc-warn">
                  {formatNumber(gane.entregasSinCosto)} entregas sin costo cargado: la cifra es un
                  tope, no la ganancia final
                </span>
              </>
            )}
          </>
        }
        onDrill={() => openDrilldown(grupos.entregados())}
      />
    ) : (
      <KpiCard
        label="Gané"
        value="—"
        destacado
        origin={origin}
        className={clase}
        sub="El contrato no envió la ganancia para este rol o periodo."
      />
    )
  ) : (
    <KpiCard
      label="Entregado"
      value={formatSoles(entregado.entregado)}
      destacado
      origin={origin}
      className={clase}
      glosario="efectividad_entrega"
      delta={
        anterior ? calcularDelta(entregado.entregado, anterior.entregado.entregado) : undefined
      }
      sub={`${formatNumber(entregado.entregas)} pedidos · efectividad ${formatPercent(entregado.efectividadEntrega)}`}
      onDrill={() => openDrilldown(grupos.entregados())}
    />
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Vendí"
        glosario="venta"
        value={formatSoles(vendi.facturacion)}
        destacado
        origin={origin}
        className={clase}
        delta={anterior ? calcularDelta(vendi.facturacion, anterior.vendi.facturacion) : undefined}
        sub={
          <>
            {formatNumber(vendi.ventas)} ventas · ticket {formatSoles(vendi.ticket)}
            <br />
            {formatNumber(vendi.leads)} leads · {formatPercent(vendi.confirmacion)} confirmados
          </>
        }
        onDrill={() => openDrilldown(grupos.ventas())}
      />
      {segunda}
      <KpiCard
        label="Me deben"
        glosario="me_deben"
        value={formatSoles(meDeben.total)}
        destacado
        origin={origin}
        className={clase}
        sub={
          <>
            Por liquidar {formatSoles(meDeben.porLiquidar)} · en curso{" "}
            {formatSoles(meDeben.enCursoPorCobrar)}
            <br />
            <b className="text-pc-bad">{formatSoles(meDeben.vencido)} vencido</b> en couriers
          </>
        }
        onDrill={() => openDrilldown(grupos.noCobrado())}
      />
      <KpiCard
        label="Por hacer hoy"
        value={`${formatNumber(acciones.length)} ${acciones.length === 1 ? "tarea" : "tareas"}`}
        destacado
        origin={origin}
        className={clase}
        sub={
          <>
            {formatNumber(pedidosEsperando)} pedidos esperan una acción
            <br />
            {formatNumber(urgentes)} urgentes · estado actual
          </>
        }
        onDrill={onVerTareas}
        drillLabel="Ver la lista"
      />
    </div>
  );
}
