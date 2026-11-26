"use client";

/**
 * Reporte rápido (Administración › Ventas) — FEAT-34.
 *
 * - Números del periodo de `useResultadosPeriodo`: la misma cuenta que Resultados › Resumen. «Utilidad operativa» es
 *   `resultados.utilidadOperativa` (antes la «GANANCIA» propia no restaba gastos fijos, merma ni comisiones).
 * - Proyección del mes solo con el mes en curso hasta hoy: ventas y utilidad al ritmo diario × días del mes. Con otro
 *   periodo se compara contra la meta repartida por días. Metas del año del periodo y sin valores por defecto.
 * - Cobros en calle: `usePedidosEnTransito` (con guía, en envío y despachados, últimos 90 días).
 * - Simulador sin doble conteo: gastos fijos sin publicidad, publicidad aparte, envío por pedido = envíos ÷ pedidos.
 * - Publicidad del módulo con días cerrados (`hastaAyer`) y una sola tarjeta de costo por venta. La inversión manual
 *   del navegador ya no se usa.
 */

import { useQuery } from "@tanstack/react-query";
import { Copy, RotateCcw } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdvertisingBusinessMetricsPanel } from "@/components/advertising/AdvertisingBusinessMetricsPanel";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { getCourierSettlements, settlementMoney } from "@/services/courierSettlementsService";
import {
  Aviso,
  AvisoCostos,
  claseBotonSecundario,
  claseInput,
  Dato,
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  KpiCard,
  type LineaCascada,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
  TablaCascada,
} from "../_components/ui";
import { courierSettlementBalances } from "../_lib/courierSettlementBalances";
import { type MetasAnuales, useMetasAnuales } from "../_lib/metasStorage";
import {
  type DiaKey,
  diasDelMes,
  diasEntre,
  etiquetaPeriodo,
  hastaAyer,
  inicioDeMes,
  mesesDelPeriodo,
  partes,
} from "../_lib/periodo";
import type { EstadoPublicidad } from "../_lib/publicidad";
import type { Resultados } from "../_lib/resultados";
import { useAdminContexto, usePedidosEnTransito, useResultadosPeriodo } from "../_lib/useResultados";
import { diaVenta, ESTADOS_EN_TRANSITO, type PedidoAdmin, saldoPedido } from "../_lib/ventas";

const STALE = 5 * 60 * 1000;
const RUTA_METAS = "/administracion/anual";
const RUTA_PUBLICIDAD = "/administracion/pauta";
const RUTA_GASTOS = "/administracion/gastos";
const RUTA_LIQUIDACIONES = "/operaciones/liquidaciones";
/** Un pedido en calle hace más de esto probablemente quedó sin cerrar. */
const DIAS_EN_CALLE_ALERTA = 30;

// ---- Cuentas de la página ---------------------------------------------------------------------

interface ProyeccionMes {
  diasTranscurridos: number;
  diasMes: number;
  ventas: number;
  utilidad: number;
}

/**
 * Solo con el mes en curso del 1 a hoy. Los gastos fijos ya vienen repartidos por días, así que escalar la utilidad
 * por días del mes ÷ días transcurridos es la misma cuenta de Resumen con el mes entero.
 */
function proyectarMes(r: Resultados, desde: DiaKey, hasta: DiaKey, hoy: DiaKey): ProyeccionMes | null {
  if (desde !== inicioDeMes(hoy) || hasta !== hoy) return null;
  const [anio, mes] = partes(hoy);
  const diasMes = diasDelMes(anio, mes);
  const diasTranscurridos = diasEntre(desde, hoy);
  if (diasTranscurridos <= 0) return null;
  const factor = diasMes / diasTranscurridos;
  return { diasTranscurridos, diasMes, ventas: r.ventas * factor, utilidad: r.utilidadOperativa * factor };
}

/** Meta anual repartida por los días del periodo (como los gastos). null si no hay meta o el periodo cruza de año. */
function metaDelPeriodo(metaAnual: number | null, anio: number, desde: DiaKey, hasta: DiaKey): number | null {
  if (metaAnual === null) return null;
  const tramos = mesesDelPeriodo(desde, hasta);
  if (tramos.length === 0 || tramos.some((t) => t.anio !== anio)) return null;
  return tramos.reduce((s, t) => s + (metaAnual / 12) * (t.dias / t.diasMes), 0);
}

interface Supuestos {
  /** % de cambio del precio de venta. */
  precio: number;
  /** % de cambio de la publicidad. */
  publicidad: number;
  /** Cuánto suben las unidades (%) por cada 10 % más de publicidad. */
  respuesta: number;
}

const SUPUESTOS_INICIALES: Supuestos = { precio: 0, publicidad: 0, respuesta: 4 };

interface Simulacion {
  precioUnidad: number;
  costoUnidad: number;
  envioPorPedido: number;
  tasaComision: number;
  unidades: number;
  ventas: number;
  publicidad: number;
  contribucionUnidad: number | null;
  puntoEquilibrio: number | null;
  utilidad: number;
}

/**
 * Con los supuestos en cero devuelve la utilidad operativa real del periodo: misma cuenta, mismas líneas. El costo de
 * producto es el cargado (las ventas sin costo siguen sin costo, como en Resumen).
 */
function simular(r: Resultados, s: Supuestos): Simulacion | null {
  if (r.unidades <= 0 || r.pedidos <= 0) return null;
  const precioUnidad = (r.ventas / r.unidades) * (1 + s.precio / 100);
  const costoUnidad = r.costoProducto / r.unidades;
  const envioPorPedido = r.envios / r.pedidos;
  const tasaComision = r.ventas > 0 ? r.comisiones / r.ventas : 0;
  const cambioPublicidad = r.publicidad.total > 0 ? s.publicidad / 100 : 0;
  const factorUnidades = Math.max(0, 1 + (s.respuesta / 10) * cambioPublicidad);
  const unidades = r.unidades * factorUnidades;
  const pedidos = r.pedidos * factorUnidades;
  const ventas = unidades * precioUnidad;
  const publicidad = r.publicidad.total * (1 + cambioPublicidad);
  const contribucion =
    ventas - unidades * costoUnidad - r.merma - ventas * tasaComision - pedidos * envioPorPedido - publicidad;
  const contribucionUnidad = unidades > 0 ? contribucion / unidades : null;
  return {
    precioUnidad,
    costoUnidad,
    envioPorPedido,
    tasaComision,
    unidades,
    ventas,
    publicidad,
    contribucionUnidad,
    puntoEquilibrio:
      contribucionUnidad !== null && contribucionUnidad > 0 ? Math.ceil(r.gastosFijos / contribucionUnidad) : null,
    utilidad: contribucion - r.gastosFijos,
  };
}

function lineasReporte(r: Resultados): LineaCascada[] {
  const lineas: LineaCascada[] = [
    { clave: "ventas", etiqueta: "Ventas", monto: r.ventas, signo: "+" },
    { clave: "sin_igv", etiqueta: "Ventas sin IGV", monto: r.ventasSinIgv, signo: "=", informativa: true },
    {
      clave: "costo",
      etiqueta: "Costo de producto",
      monto: r.costoProducto,
      signo: "−",
      nota:
        r.costo.sinCostoPedidos > 0
          ? `${formatNumber(r.costo.sinCostoPedidos)} ${r.costo.sinCostoPedidos === 1 ? "venta" : "ventas"} sin costo cargado: el costo real es mayor`
          : undefined,
    },
  ];
  if (r.merma > 0) lineas.push({ clave: "merma", etiqueta: "Merma", monto: r.merma, signo: "−" });
  lineas.push(
    { clave: "comisiones", etiqueta: "Comisiones de canal", monto: r.comisiones, signo: "−" },
    { clave: "envios", etiqueta: "Envíos", monto: r.envios, signo: "−" },
    {
      clave: "publicidad",
      etiqueta: "Publicidad",
      monto: r.publicidad.total,
      signo: "−",
      nota: r.publicidad.conectada === null ? "Sin dato de las cuentas conectadas: solo Gastos › Publicidad" : undefined,
    },
    { clave: "fijos", etiqueta: "Gastos fijos (repartidos por días)", monto: r.gastosFijos, signo: "−" },
    { clave: "utilidad", etiqueta: "Utilidad operativa", monto: r.utilidadOperativa, signo: "=", total: true },
  );
  return lineas;
}

function textoParaCompartir(r: Resultados, etiqueta: string): string {
  const filas = [
    `Reporte ${etiqueta}`,
    "",
    `Ventas: ${formatSoles(r.ventas)} (${formatNumber(r.pedidos)} pedidos, ${formatNumber(r.unidades)} unidades)`,
    `Costo de producto: ${formatSoles(r.costoProducto)}`,
    `Comisiones de canal: ${formatSoles(r.comisiones)}`,
    `Envíos: ${formatSoles(r.envios)}`,
    `Publicidad: ${formatSoles(r.publicidad.total)}`,
    `Gastos fijos: ${formatSoles(r.gastosFijos)}`,
    `Utilidad operativa: ${formatSoles(r.utilidadOperativa)} (margen ${formatPercent(r.margenOperativo)})`,
  ];
  if (r.merma > 0) filas.splice(4, 0, `Merma: ${formatSoles(r.merma)}`);
  if (r.costo.sinCostoPedidos > 0) {
    filas.push("", `Ojo: ${formatNumber(r.costo.sinCostoPedidos)} ventas sin costo cargado, la utilidad está sobreestimada.`);
  }
  filas.push("", "— vía Powip");
  return filas.join("\n");
}

const NOMBRE_ESTADO_TRANSITO: Record<(typeof ESTADOS_EN_TRANSITO)[number], string> = {
  ASIGNADO_A_GUIA: "Con guía asignada",
  EN_ENVIO: "En envío",
  DESPACHADO: "Despachado",
};

function resumirTransito(pedidos: PedidoAdmin[], hoy: DiaKey) {
  const porEstado = ESTADOS_EN_TRANSITO.map((estado) => {
    const lista = pedidos.filter((p) => p.status === estado);
    return { estado, pedidos: lista.length, saldo: lista.reduce((s, p) => s + saldoPedido(p), 0) };
  });
  const antiguos = pedidos.filter((p) => {
    const dia = diaVenta(p);
    return !!dia && diasEntre(dia, hoy) > DIAS_EN_CALLE_ALERTA;
  });
  return { porEstado, antiguos: antiguos.length, saldoAntiguos: antiguos.reduce((s, p) => s + saldoPedido(p), 0) };
}

const MENSAJE_PUBLICIDAD: Partial<Record<EstadoPublicidad, string>> = {
  sin_permiso: "No tienes permiso para ver la publicidad de la empresa.",
  sin_cuentas: "No hay cuentas de publicidad conectadas. Conéctalas en Publicidad para ver el costo por venta.",
  sin_servicio: "El módulo de publicidad no está disponible por ahora.",
};

// ---- Piezas -------------------------------------------------------------------------------------

function FilaMeta({ etiqueta, logrado, meta }: { etiqueta: string; logrado: number; meta: number | null }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="font-semibold text-pc-text">{etiqueta}</span>
        {meta === null ? (
          <span className="text-pc-text-muted">Sin meta</span>
        ) : (
          <span className="tabular-nums text-pc-text-muted">
            {formatSoles(logrado)} de {formatSoles(meta)} ·{" "}
            <b className="text-pc-text">{formatPercent(meta > 0 ? logrado / meta : null)}</b>
          </span>
        )}
      </div>
      {meta !== null && <ProgressBar logrado={Math.max(0, logrado)} meta={meta} etiqueta={`${etiqueta} contra la meta`} />}
    </div>
  );
}

function NotaSinMeta({ metas }: { metas: MetasAnuales }) {
  if (metas.ventasAnual !== null && metas.profitAnual !== null) return null;
  return (
    <p className="text-xs text-pc-text-muted">
      Las metas se cargan en{" "}
      <Link href={RUTA_METAS} className="font-semibold text-pc-primary hover:underline">
        Resultados › Resumen anual
      </Link>
      .
    </p>
  );
}

function Deslizador({
  id,
  etiqueta,
  valor,
  min,
  max,
  step,
  onChange,
  disabled,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  step: number;
  onChange: (valor: number) => void;
  disabled?: boolean;
  ayuda?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex justify-between gap-2 text-xs font-semibold text-pc-text">
        <span>{etiqueta}</span>
        <span className="tabular-nums">
          {valor > 0 ? "+" : ""}
          {valor} %
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-pc-primary disabled:opacity-50"
      />
      {ayuda && <p className="text-[11px] text-pc-text-muted">{ayuda}</p>}
    </div>
  );
}

// ---- Página -------------------------------------------------------------------------------------

export default function ReporteRapidoPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const { companyId, token, hoy } = useAdminContexto();
  const datos = useResultadosPeriodo(fromDate, toDate);
  const transito = usePedidosEnTransito();
  const anioPeriodo = partes(fromDate)[0];
  const [metas] = useMetasAnuales(companyId, anioPeriodo);
  const [supuestos, setSupuestos] = useState<Supuestos>(SUPUESTOS_INICIALES);

  const settlementsQ = useQuery({
    queryKey: ["courier-settlements", companyId],
    queryFn: ({ signal }) => getCourierSettlements(companyId, signal),
    enabled: !!companyId && !!token,
    retry: false,
    staleTime: STALE,
  });

  const r = datos.resultados;
  const etiqueta = etiquetaPeriodo(fromDate, toDate);
  const proyeccion = proyectarMes(r, fromDate, toDate, hoy);
  const sim = useMemo(() => simular(r, supuestos), [r, supuestos]);
  const resumenTransito = useMemo(() => resumirTransito(transito.pedidos, hoy), [transito.pedidos, hoy]);
  const balancesCourier = useMemo(
    () => courierSettlementBalances(settlementsQ.data?.collections ?? []),
    [settlementsQ.data],
  );
  const rangoPublicidad = hastaAyer(fromDate, toDate, hoy);
  const publicidadCortada = !!rangoPublicidad && rangoPublicidad.hasta !== toDate;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoParaCompartir(r, etiqueta));
      toast.success("Reporte copiado: pégalo en WhatsApp");
    } catch {
      toast.error("No se pudo copiar el reporte");
    }
  };

  if (datos.error) {
    return (
      <div className="space-y-3.5">
        <PanelError error={datos.error instanceof Error ? datos.error : new Error(String(datos.error))} />
      </div>
    );
  }

  const metaVentas = proyeccion
    ? metas.ventasAnual !== null
      ? metas.ventasAnual / 12
      : null
    : metaDelPeriodo(metas.ventasAnual, anioPeriodo, fromDate, toDate);
  const metaUtilidad = proyeccion
    ? metas.profitAnual !== null
      ? metas.profitAnual / 12
      : null
    : metaDelPeriodo(metas.profitAnual, anioPeriodo, fromDate, toDate);
  const cruzaAnio = partes(toDate)[0] !== anioPeriodo;

  const alertas: { clave: string; tono: "info" | "warn" | "bad" | "ok"; titulo: string; texto?: ReactNode }[] = [];
  if (settlementsQ.isError) {
    alertas.push({
      clave: "courier-error",
      tono: "warn",
      titulo: "No se pudieron revisar los cobros del courier por liquidar",
      texto: (
        <Link href={RUTA_LIQUIDACIONES} className="font-semibold text-pc-primary hover:underline">
          Revisa Liquidaciones
        </Link>
      ),
    });
  }
  for (const balance of balancesCourier) {
    alertas.push({
      clave: `courier-${balance.key}`,
      tono: "warn",
      titulo: `${balance.courierName}: ${settlementMoney(balance.remainingAmount, balance.currency)} cobrados y sin liquidar`,
      texto: (
        <>
          {settlementMoney(balance.reservedAmount, balance.currency)} en revisión.{" "}
          <Link href={RUTA_LIQUIDACIONES} className="font-semibold text-pc-primary hover:underline">
            Revisa Liquidaciones
          </Link>
        </>
      ),
    });
  }
  if (!datos.cargando && r.ventas > 0 && r.utilidadOperativa < 0) {
    alertas.push({
      clave: "utilidad",
      tono: "warn",
      titulo: `La utilidad operativa del periodo es negativa (${formatSoles(r.utilidadOperativa)})`,
      texto: "Revisa el detalle del reporte para ver qué línea pesa más.",
    });
  }
  if (!datos.cargando && r.gastosFijos === 0) {
    alertas.push({
      clave: "sin-fijos",
      tono: "info",
      titulo: "No hay gastos fijos cargados para este periodo",
      texto: (
        <>
          La utilidad operativa no descuenta planilla, herramientas ni otros gastos.{" "}
          <Link href={RUTA_GASTOS} className="font-semibold text-pc-primary hover:underline">
            Cárgalos en Costos › Gastos y costos
          </Link>
          .
        </>
      ),
    });
  }
  if (resumenTransito.antiguos > 0) {
    alertas.push({
      clave: "transito-antiguo",
      tono: "info",
      titulo: `${formatNumber(resumenTransito.antiguos)} ${resumenTransito.antiguos === 1 ? "pedido sigue" : "pedidos siguen"} en calle después de ${DIAS_EN_CALLE_ALERTA} días`,
      texto: `${formatSoles(resumenTransito.saldoAntiguos)} por cobrar. Revisa si se entregaron o se devolvieron y actualiza su estado.`,
    });
  }

  return (
    <div className="space-y-3.5">
      {!datos.cargando && <AvisoCostos costo={r.costo} />}

      {datos.cargando ? (
        <PanelSkeleton variant="kpis" label="resultados del periodo" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Ventas"
            value={formatSoles(r.ventas)}
            sub={`${formatNumber(r.pedidos)} pedidos · ${formatNumber(r.unidades)} unidades`}
          />
          <KpiCard
            label="Costo de producto"
            value={formatSoles(r.costoProducto)}
            sub={`${formatPercent(r.ventas > 0 ? r.costoProducto / r.ventas : null)} de las ventas`}
          />
          <KpiCard
            label="Publicidad"
            value={formatSoles(r.publicidad.total)}
            sub={
              r.publicidad.conectada === null
                ? `Gastos › Publicidad ${formatSoles(r.publicidad.gastos)} · cuentas conectadas sin dato`
                : `Conectada ${formatSoles(r.publicidad.conectada)} · Gastos ${formatSoles(r.publicidad.gastos)}`
            }
          />
          <KpiCard
            label="Envíos"
            value={formatSoles(r.envios)}
            sub={
              r.pedidos > 0 ? `${formatSolesDecimales(r.envios / r.pedidos)} por pedido` : "Cotización del courier"
            }
          />
          <KpiCard label="Gastos fijos" value={formatSoles(r.gastosFijos)} sub="Del mes, repartidos por días" />
          <KpiCard
            label="Utilidad operativa"
            value={<span className={r.utilidadOperativa < 0 ? "text-pc-bad" : undefined}>{formatSoles(r.utilidadOperativa)}</span>}
            sub={`Margen ${formatPercent(r.margenOperativo)} · igual que en Resumen`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard
          titulo={`Reporte · ${etiqueta}`}
          subtitulo="La misma cuenta de Resultados › Resumen. Ventas con IGV, como se cobran."
          acciones={
            <button type="button" className={claseBotonSecundario} onClick={copiar} disabled={datos.cargando}>
              <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar para WhatsApp
            </button>
          }
        >
          {datos.cargando ? (
            <PanelSkeleton variant="tabla" label="reporte del periodo" />
          ) : (
            <TablaCascada lineas={lineasReporte(r)} base={r.ventas} caption={`Reporte de ${etiqueta}`} />
          )}
        </PanelCard>

        <PanelCard
          titulo={proyeccion ? "Proyección del mes" : "Meta del periodo"}
          subtitulo={
            proyeccion
              ? `Al ritmo de los ${proyeccion.diasTranscurridos} días que van de ${proyeccion.diasMes}. Hoy cuenta aunque todavía no termina.`
              : "La proyección del mes sale con «Este mes» (del 1 a hoy). Acá, lo logrado contra la meta repartida por días."
          }
        >
          {datos.cargando ? (
            <PanelSkeleton variant="linea" label="proyección" />
          ) : (
            <div className="space-y-3">
              {proyeccion && (
                <dl className="grid grid-cols-2 gap-3">
                  <Dato label="Ventas al cierre" valor={formatSoles(proyeccion.ventas)} sub={`Van ${formatSoles(r.ventas)}`} />
                  <Dato
                    label="Utilidad operativa al cierre"
                    valor={formatSoles(proyeccion.utilidad)}
                    tono={proyeccion.utilidad < 0 ? "bad" : undefined}
                    sub="Misma cuenta, con los gastos del mes entero"
                  />
                </dl>
              )}
              {cruzaAnio && !proyeccion ? (
                <p className="text-xs text-pc-text-muted">
                  El periodo cruza de un año a otro: elige uno dentro del mismo año para compararlo con la meta.
                </p>
              ) : (
                <>
                  <FilaMeta
                    etiqueta={proyeccion ? "Ventas al cierre vs meta del mes" : "Ventas vs meta"}
                    logrado={proyeccion ? proyeccion.ventas : r.ventas}
                    meta={metaVentas}
                  />
                  <FilaMeta
                    etiqueta={proyeccion ? "Utilidad al cierre vs meta del mes" : "Utilidad operativa vs meta"}
                    logrado={proyeccion ? proyeccion.utilidad : r.utilidadOperativa}
                    meta={metaUtilidad}
                  />
                  <NotaSinMeta metas={metas} />
                </>
              )}
            </div>
          )}
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard
          titulo="Simulador · ¿qué pasa si…?"
          subtitulo="Parte de los números reales del periodo. Con todo en cero da la utilidad operativa de arriba."
          acciones={
            <button
              type="button"
              className={claseBotonSecundario}
              onClick={() => setSupuestos(SUPUESTOS_INICIALES)}
              disabled={supuestos === SUPUESTOS_INICIALES}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Volver a lo real
            </button>
          }
        >
          {datos.cargando ? (
            <PanelSkeleton variant="tabla" label="simulador" />
          ) : !sim ? (
            <p className="text-xs text-pc-text-muted">Sin ventas en el periodo: no hay con qué simular.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Deslizador
                  id="sim-precio"
                  etiqueta="Precio de venta"
                  valor={supuestos.precio}
                  min={-20}
                  max={20}
                  step={1}
                  onChange={(precio) => setSupuestos((s) => ({ ...s, precio }))}
                  ayuda={`Hoy ${formatSolesDecimales(r.ventas / r.unidades)} por unidad`}
                />
                <Deslizador
                  id="sim-publicidad"
                  etiqueta="Publicidad"
                  valor={supuestos.publicidad}
                  min={-50}
                  max={100}
                  step={5}
                  disabled={r.publicidad.total <= 0}
                  onChange={(publicidad) => setSupuestos((s) => ({ ...s, publicidad }))}
                  ayuda={
                    r.publicidad.total > 0
                      ? `Sobre ${formatSoles(r.publicidad.total)} del periodo`
                      : "Sin publicidad en el periodo: este cambio no aplica"
                  }
                />
              </div>
              <div className="rounded-xl border border-pc-border bg-pc-surface-muted px-3 py-2 text-xs text-pc-text">
                <label htmlFor="sim-respuesta" className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">Supuesto:</span> por cada 10 % más de publicidad, tus unidades suben
                  <input
                    id="sim-respuesta"
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={supuestos.respuesta}
                    onChange={(e) =>
                      setSupuestos((s) => ({ ...s, respuesta: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    className={`${claseInput} w-16 text-right tabular-nums`}
                  />
                  %
                </label>
                <p className="mt-1 text-pc-text-muted">
                  No sale de tus datos: cámbialo según lo que viste en tus campañas.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Dato label="Ventas estimadas" valor={formatSoles(sim.ventas)} sub={`${formatNumber(sim.unidades)} unidades`} />
                <Dato
                  label="Utilidad operativa estimada"
                  valor={formatSoles(sim.utilidad)}
                  tono={sim.utilidad < 0 ? "bad" : "ok"}
                  sub={`Real ${formatSoles(r.utilidadOperativa)}`}
                />
                <Dato
                  label="Contribución por unidad"
                  valor={formatSolesDecimales(sim.contribucionUnidad)}
                  sub="Después de costo, envío, comisión y publicidad"
                />
                <Dato
                  label="Punto de equilibrio"
                  valor={sim.puntoEquilibrio !== null ? `${formatNumber(sim.puntoEquilibrio)} u` : SIN_DATO}
                  sub="Unidades para cubrir los gastos fijos"
                />
              </dl>
              <p className="text-[11px] leading-relaxed text-pc-text-muted">
                Con los datos del periodo: costo {formatSolesDecimales(sim.costoUnidad)} por unidad · envío{" "}
                {formatSolesDecimales(sim.envioPorPedido)} por pedido (envíos ÷ pedidos) · comisiones{" "}
                {formatPercent(sim.tasaComision, 1)} de las ventas · gastos fijos {formatSoles(r.gastosFijos)} · publicidad
                simulada {formatSoles(sim.publicidad)}.
              </p>
            </div>
          )}
        </PanelCard>

        <div className="space-y-3.5">
          <PanelCard
            titulo="Por cobrar en calle (contra entrega)"
            subtitulo={`Pedidos en calle de los últimos ${diasEntre(transito.desde, transito.hasta)} días: con guía asignada, en envío o despachados. Es una foto de hoy, no depende del periodo.`}
          >
            {transito.cargando ? (
              <PanelSkeleton variant="linea" label="pedidos en calle" />
            ) : transito.error ? (
              <p className="text-xs text-pc-text-muted">No se pudieron leer los pedidos en calle.</p>
            ) : (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-3">
                  <Dato label="Saldo por cobrar" valor={formatSoles(transito.saldo)} />
                  <Dato label="Pedidos en calle" valor={formatNumber(transito.pedidos.length)} />
                </dl>
                <ul className="space-y-1 text-xs" aria-label="Pedidos en calle por estado">
                  {resumenTransito.porEstado.map((fila) => (
                    <li key={fila.estado} className="flex justify-between gap-2 border-t border-pc-border-soft pt-1">
                      <span className="text-pc-text-muted">{NOMBRE_ESTADO_TRANSITO[fila.estado]}</span>
                      <span className="tabular-nums text-pc-text">
                        {formatNumber(fila.pedidos)} · {formatSoles(fila.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </PanelCard>

          <PanelCard titulo="Para atender">
            {alertas.length === 0 ? (
              <p className="text-xs text-pc-text-muted">Sin alertas con los datos disponibles.</p>
            ) : (
              <div className="space-y-2">
                {alertas.map((a) => (
                  <Aviso key={a.clave} tono={a.tono} titulo={a.titulo}>
                    {a.texto}
                  </Aviso>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      </div>

      <PanelCard
        titulo="Publicidad: costo por venta y retorno"
        subtitulo={
          rangoPublicidad
            ? `Del módulo de publicidad, con días cerrados (${etiquetaPeriodo(rangoPublicidad.desde, rangoPublicidad.hasta)}). No incluye lo cargado en Gastos › Publicidad.`
            : undefined
        }
        acciones={
          <Link href={RUTA_PUBLICIDAD} className={claseBotonSecundario}>
            Ver por tienda y canal
          </Link>
        }
      >
        {!rangoPublicidad ? (
          <p className="text-xs text-pc-text-muted">
            Los cocientes de publicidad salen con días cerrados: elige un periodo que termine ayer.
          </p>
        ) : MENSAJE_PUBLICIDAD[datos.publicidad.estado] ? (
          <p className="text-xs text-pc-text-muted">{MENSAJE_PUBLICIDAD[datos.publicidad.estado]}</p>
        ) : datos.publicidad.estado === "cargando" ? (
          <PanelSkeleton variant="grafico" label="publicidad" />
        ) : (
          <div className="space-y-3">
            {publicidadCortada && (
              <Aviso tono="info">
                Llega hasta ayer: hoy todavía no cierra y los cocientes de publicidad solo salen con días cerrados.
              </Aviso>
            )}
            <AdvertisingBusinessMetricsPanel from={rangoPublicidad.desde} to={rangoPublicidad.hasta} />
          </div>
        )}
      </PanelCard>
    </div>
  );
}
