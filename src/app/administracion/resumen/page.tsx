"use client";

/**
 * Resultados › Resumen (FEAT-34).
 *
 * Estado de resultados del periodo con la cuenta única de `_lib/resultados.ts` (la misma de Utilidad, Punto de
 * equilibrio, Reporte, Flujo y Anual) y comparado contra el mismo tramo del mes anterior (`periodoAnterior`).
 *
 * - Sin «IGV/IR estimado» ni comisión Powip (D3, D4): las ventas se muestran con IGV y, como dato informativo, sin IGV.
 * - Publicidad de una sola fuente (D2): consumo conectado + Gastos › Publicidad. La inversión manual del navegador
 *   ya no entra.
 * - Gastos mensuales repartidos por días del periodo (D8).
 * - Metas sin valores por defecto (D5): sin meta se dice «Sin meta».
 * - Las ventas llegan calculadas de ms-ventas y se cuentan el día en que se ENTREGARON (D1).
 * - Envíos = flete por pedido (D9), con la nota de en cuántas entregas se conoce.
 * - Adelantos: lo cobrado de pedidos creados en el periodo que todavía no son venta (sin entregados, anulados,
 *   incompletos ni leads); lo calcula ms-ventas (`enCurso`).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import { type Nivel, NivelPill } from "../_components/nivel";
import {
  Aviso,
  AvisoCostos,
  Dato,
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
  KpiCard,
  type LineaCascada,
  NotaSinHistorial,
  PanelCard,
  PanelError,
  PanelSkeleton,
  TablaCascada,
} from "../_components/ui";
import { metaVentasMensual, useMetasAnuales } from "../_lib/metasStorage";
import {
  type DiaKey,
  etiquetaPeriodo,
  inicioDeMes,
  MESES_LARGOS,
  mesesDelPeriodo,
  partes,
} from "../_lib/periodo";
import type { PublicidadConectada } from "../_lib/publicidad";
import type { Resultados } from "../_lib/resultados";
import { type CoberturaFlete, notaFlete } from "../_lib/servidor";
import { useAdminContexto, useResultadosComparados } from "../_lib/useResultados";

// ---- Cálculos de la pantalla ------------------------------------------------------------------

const plural = (n: number, uno: string, varios: string) =>
  `${formatNumber(n)} ${n === 1 ? uno : varios}`;

function notaPublicidad(r: Resultados, p: PublicidadConectada): string {
  const gastos = `Gastos › Publicidad ${formatSoles(r.publicidad.gastos)}`;
  switch (p.estado) {
    case "ok": {
      const partesNota = [`Conectada ${formatSoles(r.publicidad.conectada)} + ${gastos}`];
      if (p.provisional) partesNota.push("incluye hoy, que la plataforma todavía puede corregir");
      if (p.diasFaltantes > 0 || p.cobertura === "partial")
        partesNota.push("faltan días por importar");
      if (p.otrasMonedas.length > 0)
        partesNota.push(`sin contar el gasto en ${p.otrasMonedas.join(", ")}`);
      return partesNota.join(" · ");
    }
    case "sin_cuentas":
      return `Sin cuentas de publicidad conectadas: solo ${gastos}`;
    case "cargando":
      return `Cargando las cuentas conectadas… por ahora solo ${gastos}`;
    case "sin_permiso":
      return `No tienes permiso para ver las cuentas conectadas: solo ${gastos}`;
    default:
      return `No se pudo leer el consumo de las cuentas conectadas: solo ${gastos}`;
  }
}

function lineasCascada(
  r: Resultados,
  publicidad: PublicidadConectada,
  igvPct: number,
  flete: CoberturaFlete,
): LineaCascada[] {
  const nota = notaFlete(flete);
  return [
    { clave: "ventas", etiqueta: "Ventas (con IGV)", monto: r.ventas, signo: "+" },
    {
      clave: "igv",
      etiqueta: `IGV incluido (${igvPct}%)`,
      monto: r.igvIncluido,
      signo: "=",
      informativa: true,
    },
    {
      clave: "sin_igv",
      etiqueta: "Ventas sin IGV",
      monto: r.ventasSinIgv,
      signo: "=",
      informativa: true,
    },
    {
      clave: "costo",
      etiqueta: "Costo de producto",
      monto: r.costoProducto,
      signo: "−",
      nota:
        r.costo.sinCostoPedidos > 0
          ? `${plural(r.costo.sinCostoPedidos, "venta", "ventas")} sin costo cargado: el costo real es mayor`
          : undefined,
    },
    { clave: "merma", etiqueta: "Merma", monto: r.merma, signo: "−" },
    { clave: "bruta", etiqueta: "Utilidad bruta", monto: r.utilidadBruta, signo: "=", total: true },
    { clave: "comisiones", etiqueta: "Comisiones de canal", monto: r.comisiones, signo: "−" },
    {
      clave: "envios",
      etiqueta: "Envíos (flete por pedido)",
      monto: r.envios,
      signo: "−",
      nota: nota?.texto,
      notaTono: nota?.baja ? "aviso" : "info",
    },
    {
      clave: "publicidad",
      etiqueta: "Publicidad",
      monto: r.publicidad.total,
      signo: "−",
      nota: notaPublicidad(r, publicidad),
      notaTono:
        publicidad.estado === "ok" && !publicidad.provisional && publicidad.diasFaltantes === 0 ? "info" : "aviso",
    },
    {
      clave: "contribucion",
      etiqueta: "Contribución",
      monto: r.contribucion,
      signo: "=",
      total: true,
    },
    {
      clave: "fijos",
      etiqueta: "Gastos fijos",
      monto: r.gastosFijos,
      signo: "−",
      nota:
        r.gastosFijos > 0
          ? "Gasto mensual × días del periodo ÷ días del mes"
          : "Sin gastos fijos cargados: cárgalos en Costos › Gastos y costos",
      notaTono: r.gastosFijos > 0 ? "info" : "aviso",
    },
    {
      clave: "operativa",
      etiqueta: "Utilidad operativa",
      monto: r.utilidadOperativa,
      signo: "=",
      total: true,
    },
  ];
}

// ---- Semáforo COD -----------------------------------------------------------------------------

interface Indicador {
  id: string;
  nombre: string;
  valor: string;
  nivel: Nivel;
  umbral: string;
  ayuda: string;
}

const ETIQUETA_NIVEL: Record<Nivel, string> = {
  verde: "Bien",
  ambar: "Atención",
  rojo: "Alerta",
  azul: "Info",
  "sin-datos": "Sin datos",
};

/** Umbrales de siempre de la pantalla (doc técnica §7.7). */
function nivelCostoPorVenta(valor: number | null): Nivel {
  if (valor === null) return "sin-datos";
  return valor < 18 ? "verde" : valor <= 22 ? "ambar" : "rojo";
}

function nivelRetorno(valor: number | null): Nivel {
  if (valor === null) return "sin-datos";
  return valor > 4 ? "verde" : valor >= 3 ? "ambar" : "rojo";
}

function nivelMargen(valor: number | null): Nivel {
  if (valor === null) return "sin-datos";
  return valor > 0.28 ? "verde" : valor >= 0.2 ? "ambar" : "rojo";
}

function indicadoresCod(r: Resultados): Indicador[] {
  const sinPublicidad = r.publicidad.total <= 0;
  return [
    {
      id: "costo_venta",
      nombre: "Costo de publicidad por venta",
      valor: formatSoles(r.costoPublicidadPorVenta),
      nivel: nivelCostoPorVenta(r.costoPublicidadPorVenta),
      umbral: "Verde < S/ 18 · ámbar S/ 18–22 · rojo > S/ 22",
      ayuda: sinPublicidad
        ? "Sin publicidad registrada en el periodo"
        : r.pedidos === 0
          ? "Sin ventas en el periodo"
          : "Publicidad ÷ pedidos entregados",
    },
    {
      id: "retorno",
      nombre: "Retorno de publicidad",
      valor: formatVeces(r.retornoPublicidad),
      nivel: nivelRetorno(r.retornoPublicidad),
      umbral: "Verde > 4x · ámbar 3–4x · rojo < 3x",
      ayuda: sinPublicidad ? "Sin publicidad registrada en el periodo" : "Ventas ÷ publicidad",
    },
    {
      id: "margen",
      nombre: "Margen operativo",
      valor: formatPercent(r.margenOperativo, 1),
      nivel: nivelMargen(r.margenOperativo),
      umbral: "Verde > 28% · ámbar 20–28% · rojo < 20%",
      ayuda:
        r.margenOperativo === null ? "Sin ventas en el periodo" : "Utilidad operativa ÷ ventas",
    },
  ];
}

/** El peor de los indicadores con dato. */
function peorNivel(niveles: Nivel[]): Nivel {
  const conDato = niveles.filter((n) => n !== "sin-datos");
  if (conDato.length === 0) return "sin-datos";
  if (conDato.includes("rojo")) return "rojo";
  if (conDato.includes("ambar")) return "ambar";
  return "verde";
}

// ---- Metas ------------------------------------------------------------------------------------

/**
 * Parte de la meta mensual que le toca al periodo. Un periodo que arranca el día 1 y no sale del mes se mide contra
 * el mes entero («Avance de noviembre»); cualquier otro rango, contra la meta repartida por días.
 */
function tramoDeMeta(
  desde: DiaKey,
  hasta: DiaKey,
): { factor: number; titulo: string; explicacion: string } {
  const tramos = mesesDelPeriodo(desde, hasta);
  if (tramos.length === 1 && desde === inicioDeMes(desde)) {
    return {
      factor: 1,
      titulo: `Avance de ${MESES_LARGOS[partes(desde)[1] - 1]}`,
      explicacion: "Meta del mes = meta anual ÷ 12",
    };
  }
  return {
    factor: tramos.reduce((s, t) => s + t.dias / t.diasMes, 0),
    titulo: "Avance contra la meta",
    explicacion: "Meta del periodo = meta mensual × días del periodo ÷ días del mes",
  };
}

function FilaAvance({
  etiqueta,
  logrado,
  meta,
}: {
  etiqueta: string;
  logrado: number;
  meta: number;
}) {
  const avance = meta > 0 ? logrado / meta : null;
  const falta = meta - logrado;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="font-semibold text-pc-text">{etiqueta}</span>
        <span className="tabular-nums text-pc-text-muted">
          {formatSoles(logrado)} de {formatSoles(meta)} ({formatPercent(avance)})
        </span>
      </div>
      <ProgressBar logrado={logrado} meta={meta} etiqueta={`${etiqueta} sobre la meta`} />
      <p className="mt-1 text-[11px] text-pc-text-muted">
        {falta > 0 ? `Faltan ${formatSoles(falta)}` : "Meta cumplida"}
      </p>
    </div>
  );
}

// ---- Página -----------------------------------------------------------------------------------

function Nota({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-pc-text-muted">{children}</p>;
}

export default function ResumenAdminPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const { companyId, igvPct } = useAdminContexto();
  const { actual, anterior, rangoAnterior } = useResultadosComparados(fromDate, toDate);
  const [metas] = useMetasAnuales(companyId, partes(fromDate)[0]);

  const { adelantos, pedidos: pedidosEnCurso } = actual.servidor.enCurso;

  if (actual.error) {
    return <PanelError error={actual.error instanceof Error ? actual.error : null} />;
  }
  if (actual.cargando) {
    return (
      <div className="space-y-3.5">
        <PanelSkeleton variant="kpis" label="indicadores del periodo" />
        <PanelSkeleton variant="tabla" label="estado de resultados" />
      </div>
    );
  }

  const r = actual.resultados;
  const a = anterior.cargando ? null : anterior.resultados;
  const delta = (valor: (x: Resultados) => number) =>
    a ? calcularDelta(valor(r), valor(a)) : undefined;

  const indicadores = indicadoresCod(r);
  const nivelGeneral = peorNivel(indicadores.map((i) => i.nivel));
  const enAlerta = indicadores.filter((i) => i.nivel === "ambar" || i.nivel === "rojo").length;

  const metaVentas = metaVentasMensual(metas);
  const metaUtilidad = metas.profitAnual !== null ? metas.profitAnual / 12 : null;
  const tramo = tramoDeMeta(fromDate, toDate);

  const pe = r.puntoEquilibrio;

  return (
    <div className="space-y-3.5">
      <AvisoCostos costo={r.costo} />
      <NotaSinHistorial cantidad={actual.servidor.calidad.entregasSinHistorial} />
      {r.pedidos === 0 && pedidosEnCurso > 0 && (
        <Aviso tono="info" titulo="Todavía no hay ventas en el periodo">
          Hay {plural(pedidosEnCurso, "pedido", "pedidos")} en curso. En contra entrega la venta
          cuenta recién cuando el pedido se entrega.
        </Aviso>
      )}

      <section aria-label="Indicadores del periodo" className="space-y-1.5">
        <p className="text-[11px] text-pc-text-muted">
          Variación comparada con{" "}
          <span className="font-semibold text-pc-text">
            {etiquetaPeriodo(rangoAnterior.desde, rangoAnterior.hasta)}
          </span>
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Ventas"
            value={formatSoles(r.ventas)}
            delta={delta((x) => x.ventas)}
            sub={`Sin IGV: ${formatSoles(r.ventasSinIgv)}`}
          />
          <KpiCard
            label="Utilidad bruta"
            value={formatSoles(r.utilidadBruta)}
            delta={delta((x) => x.utilidadBruta)}
            sub={`Margen ${formatPercent(r.margenBruto, 1)}`}
          />
          <KpiCard
            label="Utilidad operativa"
            value={formatSoles(r.utilidadOperativa)}
            delta={delta((x) => x.utilidadOperativa)}
            sub={`Margen ${formatPercent(r.margenOperativo, 1)}`}
          />
          <KpiCard
            label="Pedidos entregados"
            value={formatNumber(r.pedidos)}
            delta={delta((x) => x.pedidos)}
            sub={`Ticket promedio ${formatSoles(r.ticketPromedio)} · ${plural(r.unidades, "unidad", "unidades")}`}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard
          titulo="Estado de resultados"
          subtitulo="De las ventas entregadas a la utilidad operativa. Los % son sobre las ventas con IGV."
        >
          <TablaCascada
            lineas={lineasCascada(r, actual.publicidad, igvPct, actual.flete)}
            base={r.ventas}
            caption="Estado de resultados del periodo"
          />
        </PanelCard>

        <div className="min-w-0 space-y-3.5">
          <PanelCard
            titulo="Semáforo contra entrega"
            subtitulo="Publicidad = cuentas conectadas + Gastos › Publicidad"
            acciones={
              <NivelPill nivel={nivelGeneral}>
                {nivelGeneral === "sin-datos"
                  ? "Sin datos suficientes"
                  : enAlerta === 0
                    ? "Todo en verde"
                    : `${enAlerta} ${enAlerta === 1 ? "indicador" : "indicadores"} en alerta`}
              </NivelPill>
            }
          >
            <ul className="divide-y divide-pc-border-soft">
              {indicadores.map((indicador) => (
                <li key={indicador.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-pc-text">{indicador.nombre}</p>
                    <p className="text-[11px] text-pc-text-muted">{indicador.ayuda}</p>
                    <p className="text-[10.5px] text-pc-text-soft">{indicador.umbral}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-base font-bold tabular-nums text-pc-text">
                      {indicador.valor}
                    </span>
                    <NivelPill nivel={indicador.nivel}>{ETIQUETA_NIVEL[indicador.nivel]}</NivelPill>
                  </div>
                </li>
              ))}
            </ul>
          </PanelCard>

          <PanelCard titulo={tramo.titulo} subtitulo={tramo.explicacion}>
            {metaVentas === null && metaUtilidad === null ? (
              <p className="text-xs text-pc-text-muted">
                <span className="font-semibold text-pc-text">Sin meta</span> · cárgala en{" "}
                <Link
                  href="/administracion/anual"
                  className="font-semibold text-pc-primary hover:underline"
                >
                  Resultados › Resumen anual
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {metaVentas !== null ? (
                  <FilaAvance
                    etiqueta="Ventas"
                    logrado={r.ventas}
                    meta={metaVentas * tramo.factor}
                  />
                ) : (
                  <Nota>Sin meta de ventas.</Nota>
                )}
                {metaUtilidad !== null && (
                  <FilaAvance
                    etiqueta="Utilidad operativa"
                    logrado={r.utilidadOperativa}
                    meta={metaUtilidad * tramo.factor}
                  />
                )}
              </div>
            )}
          </PanelCard>

          <PanelCard
            titulo="Punto de equilibrio"
            subtitulo="Ventas que cubren los gastos fijos del periodo con el margen de contribución actual"
            acciones={
              <Link
                href="/administracion/equilibrio"
                className="rounded text-xs font-semibold text-pc-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pc-primary"
              >
                Ver detalle →
              </Link>
            }
          >
            {r.gastosFijos <= 0 ? (
              <Nota>
                Sin gastos fijos cargados en el periodo: no hay punto de equilibrio que calcular.
              </Nota>
            ) : pe.ventas === null ? (
              <Nota>
                {r.ventas > 0
                  ? "La contribución es cero o negativa: con estos costos ninguna venta cubre los gastos fijos."
                  : "Sin ventas en el periodo: todavía no hay margen para calcularlo."}
              </Nota>
            ) : (
              <div className="space-y-2">
                <dl className="grid grid-cols-2 gap-3">
                  <Dato label="Ventas necesarias" valor={formatSoles(pe.ventas)} />
                  <Dato
                    label="Unidades necesarias"
                    valor={formatNumber(pe.unidades)}
                    sub={`Vendidas: ${formatNumber(r.unidades)}`}
                  />
                </dl>
                <ProgressBar
                  logrado={r.ventas}
                  meta={pe.ventas}
                  etiqueta="Ventas sobre el punto de equilibrio"
                />
                <p className="text-xs text-pc-text">
                  {pe.avance !== null && pe.avance >= 1 ? (
                    <>
                      <span className="font-semibold text-pc-ok">Superado</span>: las ventas cubren{" "}
                      {formatVeces(pe.avance)} el punto de equilibrio.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-pc-warn">Por debajo</span>: faltan{" "}
                      {formatSoles(pe.ventas - r.ventas)} para cubrir los gastos fijos (vas al{" "}
                      {formatPercent(pe.avance)}).
                    </>
                  )}
                </p>
              </div>
            )}
          </PanelCard>

          <PanelCard
            titulo="Adelantos de pedidos aún no entregados"
            subtitulo="Pagos registrados de pedidos creados en el periodo que todavía no se entregan"
          >
            <dl>
              <Dato
                label="Cobrado por adelantado"
                valor={formatSoles(adelantos.monto)}
                sub={`${plural(adelantos.pedidos, "pedido", "pedidos")} · sin entregados, anulados, incompletos ni leads`}
              />
            </dl>
            <p className="mt-2 text-[11px] text-pc-text-muted">
              Es plata en caja, no utilidad: entra a las ventas cuando el pedido se entrega.
            </p>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
