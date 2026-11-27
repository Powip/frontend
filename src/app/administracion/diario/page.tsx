"use client";

/**
 * Control diario (Administración › Ventas) — FEAT-34.
 *
 * - Ventas por día de ENTREGA en hora Lima (D1), calculadas en ms-ventas (`porDia` y, por canal, `porDiaCanal`), con
 *   la definición única de venta y unidades reales (Σ cantidades sin servicios). Antes el día salía de la última
 *   edición del pedido (C2) y se contaban líneas (C6).
 * - Canales leídos de los datos (`porCanal` con las grafías agrupadas, `canalesDelServidor`) más «Todos los canales».
 *   Antes solo había 7 canales fijos y el 44 % de lo vendido (Web, TikTok, Falabella, Live…) no aparecía (C3).
 * - Publicidad por día: consumo de las cuentas conectadas (`datos.publicidad.porDia`). La inversión manual del
 *   navegador ya no se usa (C8). El consumo no viene por canal: solo se muestra en «Todos los canales».
 * - Objetivo diario por canal: guardado en el servidor (Fase 3, `objetivoStorage`), con la clave de canal normalizada.
 */

import { Target } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { BarChart, type BarDatum } from "@/components/panel-control/charts/BarChart";
import { LineChart, type LineSeries } from "@/components/panel-control/charts/LineChart";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  Aviso,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  type ColumnaTabla,
  Dato,
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  KpiCard,
  NotaSinHistorial,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { type CanalEnDatos, grupoCanal, nombreCanal } from "../_lib/canales";
import {
  avanceObjetivo,
  hayObjetivo,
  objetivoDeDias,
  objetivoDelDia,
  TODOS_LOS_CANALES,
  useObjetivoCanal,
} from "../_lib/objetivoStorage";
import { type DiaKey, diasEntre, MESES_CORTOS, minDia, partes, sumarDias } from "../_lib/periodo";
import type { EstadoPublicidad } from "../_lib/publicidad";
import {
  agregadosPorCanal,
  agregadoVacio,
  canalesDelServidor,
  resumenDeAgregado,
  serieDiaria,
  serieDiariaCanal,
} from "../_lib/servidor";
import { useAdminContexto, useResultadosPeriodo } from "../_lib/useResultados";
import type { ResumenVentas } from "../_lib/ventas";

/** Hasta esta cantidad de días el gráfico va en barras; con más, en línea. */
const MAX_DIAS_BARRAS = 62;

const AVISO_PUBLICIDAD: Partial<Record<EstadoPublicidad, string>> = {
  sin_permiso: "No tienes permiso para ver la publicidad de la empresa: las columnas de publicidad quedan vacías.",
  sin_cuentas: "No hay cuentas de publicidad conectadas, así que no hay consumo por día. Conéctalas en Publicidad.",
  sin_servicio: "El módulo de publicidad no está disponible por ahora: no hay consumo por día.",
  error: "No se pudo leer el consumo de publicidad. Vuelve a intentarlo en unos minutos.",
};

interface FilaDia {
  dia: DiaKey;
  pedidos: number;
  unidades: number;
  ventas: number;
  publicidad: number | null;
  costoPorVenta: number | null;
  objetivo: number | null;
  avance: number | null;
}

interface FilaCanal {
  clave: string;
  nombre: string;
  grafias: string[];
  resumen: ResumenVentas;
}

function diasDelRango(desde: DiaKey, hasta: DiaKey): DiaKey[] {
  return Array.from({ length: diasEntre(desde, hasta) }, (_, i) => sumarDias(desde, i));
}

function etiquetaDia(dia: DiaKey, conAnio = false): string {
  const [anio, mes, d] = partes(dia);
  return `${d} ${MESES_CORTOS[mes - 1]}${conAnio ? ` ${String(anio).slice(2)}` : ""}`;
}

const costoPorVenta = (publicidad: number | null, pedidos: number) =>
  publicidad !== null && publicidad > 0 && pedidos > 0 ? publicidad / pedidos : null;

export default function ControlDiarioPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const { companyId, hoy } = useAdminContexto();
  const datos = useResultadosPeriodo(fromDate, toDate);
  const [canalElegido, setCanalElegido] = useState<string>(TODOS_LOS_CANALES);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");

  const servidor = datos.servidor;
  const canales = useMemo<CanalEnDatos[]>(() => canalesDelServidor(servidor.porCanal), [servidor.porCanal]);
  const porCanal = useMemo(() => agregadosPorCanal(servidor.porCanal), [servidor.porCanal]);
  const canal =
    canalElegido === TODOS_LOS_CANALES || canales.some((c) => c.clave === canalElegido)
      ? canalElegido
      : TODOS_LOS_CANALES;
  const esTodos = canal === TODOS_LOS_CANALES;
  const nombreVista = esTodos ? "Todos los canales" : nombreCanal(canal);
  const { objetivo, guardar, cargado: objetivoCargado } = useObjetivoCanal(companyId, canal);

  const hastaVisible = minDia(toDate, hoy);
  const dias = useMemo(() => diasDelRango(fromDate, hastaVisible), [fromDate, hastaVisible]);
  const resumen = useMemo(
    () => (esTodos ? datos.ventas : resumenDeAgregado(porCanal.get(canal) ?? agregadoVacio())),
    [esTodos, datos.ventas, porCanal, canal],
  );
  const serie = useMemo(
    () => (esTodos ? serieDiaria(servidor.porDia) : serieDiariaCanal(servidor.porDiaCanal, canal)),
    [esTodos, servidor.porDia, servidor.porDiaCanal, canal],
  );
  const publicidad = datos.publicidad;
  const conPublicidad = esTodos && publicidad.estado === "ok";

  const filas = useMemo<FilaDia[]>(() => {
    return dias.map((dia) => {
      const r = serie.get(dia);
      const pedidos = r?.pedidos ?? 0;
      const ventas = r?.monto ?? 0;
      const pub = conPublicidad ? (publicidad.porDia.get(dia) ?? 0) : null;
      const obj = objetivoDelDia(objetivo, dia);
      return {
        dia,
        pedidos,
        unidades: r?.unidades ?? 0,
        ventas,
        publicidad: pub,
        costoPorVenta: costoPorVenta(pub, pedidos),
        objetivo: obj,
        avance: avanceObjetivo(ventas, obj),
      };
    });
  }, [serie, dias, conPublicidad, publicidad.porDia, objetivo]);

  const filasCanal = useMemo<FilaCanal[]>(
    () =>
      canales
        .map((c) => {
          const agregado = porCanal.get(c.clave);
          const resumenCanal = agregado ? resumenDeAgregado(agregado) : undefined;
          return { clave: c.clave, nombre: c.nombre, grafias: c.grafias, resumen: resumenCanal };
        })
        .filter((f): f is FilaCanal => !!f.resumen)
        .sort((a, b) => b.resumen.monto - a.resumen.monto),
    [porCanal, canales],
  );
  const totalCanales = datos.ventas;

  const publicidadTotal = conPublicidad ? filas.reduce((s, f) => s + (f.publicidad ?? 0), 0) : null;
  const costoPorVentaTotal = costoPorVenta(publicidadTotal, resumen.pedidos);
  const objetivoPeriodo = objetivoDeDias(objetivo, dias);
  const avancePeriodo = avanceObjetivo(resumen.monto, objetivoPeriodo);
  const diasCumplidos = filas.filter((f) => f.avance !== null && f.avance >= 1).length;

  const abrirEditor = () => {
    setBorrador(objetivo.ventasDia !== null ? String(objetivo.ventasDia) : "");
    setEditando(true);
  };
  const guardarObjetivo = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(borrador);
    guardar(borrador.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null);
    setEditando(false);
  };

  if (datos.error) {
    return (
      <div className="space-y-3.5">
        <PanelError error={datos.error instanceof Error ? datos.error : new Error(String(datos.error))} />
      </div>
    );
  }

  const columnasDia: ColumnaTabla<FilaDia>[] = [
    {
      id: "dia",
      header: "Día",
      align: "left",
      cell: (f) => (
        <span className="font-semibold">
          {etiquetaDia(f.dia, partes(fromDate)[0] !== partes(hastaVisible)[0])}
          {f.dia === hoy && <span className="ml-1 font-normal text-pc-text-muted">· hoy</span>}
        </span>
      ),
      sortValue: (f) => f.dia,
    },
    { id: "pedidos", header: "Pedidos", cell: (f) => formatNumber(f.pedidos), sortValue: (f) => f.pedidos },
    { id: "unidades", header: "Unidades", cell: (f) => formatNumber(f.unidades), sortValue: (f) => f.unidades },
    { id: "ventas", header: "Ventas", cell: (f) => formatSoles(f.ventas), sortValue: (f) => f.ventas },
    ...(esTodos
      ? ([
          {
            id: "publicidad",
            header: "Publicidad",
            cell: (f) => (f.publicidad === null ? SIN_DATO : formatSoles(f.publicidad)),
            sortValue: (f) => f.publicidad,
          },
          {
            id: "costo",
            header: "Costo por venta",
            cell: (f) => formatSolesDecimales(f.costoPorVenta),
            sortValue: (f) => f.costoPorVenta,
          },
        ] satisfies ColumnaTabla<FilaDia>[])
      : []),
    {
      id: "objetivo",
      header: "Objetivo",
      cell: (f) => (f.objetivo === null ? SIN_DATO : formatSoles(f.objetivo)),
      sortValue: (f) => f.objetivo,
    },
    {
      id: "avance",
      header: "Avance",
      cell: (f) => (
        <span className={cn(f.avance !== null && f.avance >= 1 && "font-semibold text-pc-ok")}>
          {formatPercent(f.avance)}
        </span>
      ),
      sortValue: (f) => f.avance,
    },
  ];

  const columnasCanal: ColumnaTabla<FilaCanal>[] = [
    {
      id: "canal",
      header: "Canal",
      align: "left",
      cell: (f) => (
        <button
          type="button"
          onClick={() => setCanalElegido(f.clave)}
          className="rounded text-left font-semibold text-pc-text outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
        >
          {f.nombre}
          {f.grafias.length > 1 && (
            <span className="block text-[11px] font-normal text-pc-text-muted">Llega como {f.grafias.join(", ")}</span>
          )}
        </button>
      ),
      sortValue: (f) => f.nombre,
    },
    {
      id: "tipo",
      header: "Tipo",
      align: "left",
      cell: (f) => (grupoCanal(f.clave) === "marketplace" ? "Marketplace" : "Venta directa"),
    },
    { id: "pedidos", header: "Pedidos", cell: (f) => formatNumber(f.resumen.pedidos), sortValue: (f) => f.resumen.pedidos },
    {
      id: "unidades",
      header: "Unidades",
      cell: (f) => formatNumber(f.resumen.unidades),
      sortValue: (f) => f.resumen.unidades,
    },
    { id: "ventas", header: "Ventas", cell: (f) => formatSoles(f.resumen.monto), sortValue: (f) => f.resumen.monto },
    {
      id: "participacion",
      header: "% del total",
      cell: (f) => formatPercent(totalCanales.monto > 0 ? f.resumen.monto / totalCanales.monto : null, 1),
      sortValue: (f) => f.resumen.monto,
    },
    {
      id: "ticket",
      header: "Ticket promedio",
      cell: (f) => formatSoles(f.resumen.ticketPromedio),
      sortValue: (f) => f.resumen.ticketPromedio,
    },
  ];

  const conAnio = dias.length > 366;
  const datosBarras: BarDatum[] = filas.map((f) => ({
    key: f.dia,
    label: etiquetaDia(f.dia, conAnio),
    value: f.ventas,
    comparison: f.objetivo,
    description: `${etiquetaDia(f.dia, true)}: ${formatSoles(f.ventas)} en ventas, ${formatNumber(f.pedidos)} pedidos${f.objetivo !== null ? `, objetivo ${formatSoles(f.objetivo)}` : ""}`,
  }));
  const seriesLinea: LineSeries[] = [
    { id: "ventas", nombre: "Ventas", color: "var(--pc-series-1)", valores: filas.map((f) => f.ventas) },
    ...(hayObjetivo(objetivo)
      ? [
          {
            id: "objetivo",
            nombre: "Objetivo",
            color: "var(--pc-text-soft)",
            valores: filas.map((f) => f.objetivo ?? 0),
            punteada: true,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3.5">
      <div role="group" aria-label="Canal" className="flex flex-wrap gap-1.5">
        {[{ clave: TODOS_LOS_CANALES, nombre: "Todos los canales", pedidos: totalCanales.pedidos }, ...canales].map(
          (c) => {
            const activo = c.clave === canal;
            return (
              <button
                key={c.clave}
                type="button"
                aria-pressed={activo}
                onClick={() => setCanalElegido(c.clave)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pc-primary",
                  activo
                    ? "border-pc-primary bg-pc-primary font-semibold text-pc-on-fill"
                    : "border-pc-border bg-pc-card font-medium text-pc-text-muted hover:text-pc-primary",
                )}
              >
                {c.nombre} <span className="tabular-nums opacity-80">({formatNumber(c.pedidos)})</span>
              </button>
            );
          },
        )}
      </div>

      {esTodos && !datos.cargando && AVISO_PUBLICIDAD[publicidad.estado] && (
        <Aviso tono="info">{AVISO_PUBLICIDAD[publicidad.estado]}</Aviso>
      )}
      {conPublicidad && publicidad.diasFaltantes > 0 && (
        <Aviso tono="info">
          Faltan importar {formatNumber(publicidad.diasFaltantes)} días de alguna cuenta de publicidad: el consumo puede
          estar incompleto.
        </Aviso>
      )}

      {datos.cargando ? (
        <PanelSkeleton variant="kpis" label="ventas del periodo" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Ventas"
            value={formatSoles(resumen.monto)}
            sub={`${formatNumber(resumen.pedidos)} pedidos · ticket ${formatSoles(resumen.ticketPromedio)}`}
          />
          <KpiCard
            label="Unidades"
            value={formatNumber(resumen.unidades)}
            sub={
              resumen.pedidos > 0
                ? `${(resumen.unidades / resumen.pedidos).toFixed(2)} por pedido`
                : "Suma de cantidades, sin servicios"
            }
          />
          <KpiCard
            label="Publicidad"
            loading={esTodos && publicidad.estado === "cargando"}
            value={publicidadTotal === null ? SIN_DATO : formatSoles(publicidadTotal)}
            sub={esTodos ? "Consumo de las cuentas conectadas" : "No viene separada por canal"}
          />
          <KpiCard
            label="Costo de publicidad por venta"
            loading={esTodos && publicidad.estado === "cargando"}
            value={formatSolesDecimales(costoPorVentaTotal)}
            sub="Publicidad ÷ pedidos entregados"
          />
          <KpiCard
            label="Avance vs objetivo"
            value={avancePeriodo === null ? "Sin objetivo" : formatPercent(avancePeriodo)}
            sub={
              objetivoPeriodo === null ? (
                "Ponlo en «Objetivo diario»"
              ) : (
                <>
                  {formatSoles(resumen.monto)} de {formatSoles(objetivoPeriodo)}
                  <ProgressBar logrado={resumen.monto} meta={objetivoPeriodo} etiqueta="Avance del periodo vs objetivo" />
                </>
              )
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard
          titulo={`Ventas por día · ${nombreVista}`}
          subtitulo={
            hayObjetivo(objetivo)
              ? "Pedidos entregados por día de entrega (hora Lima). La línea punteada es el objetivo."
              : "Pedidos entregados por día de entrega (hora Lima)."
          }
        >
          {datos.cargando ? (
            <PanelSkeleton variant="grafico" label="ventas por día" />
          ) : dias.length === 0 ? (
            <p className="text-xs text-pc-text-muted">El periodo elegido todavía no empieza.</p>
          ) : dias.length <= MAX_DIAS_BARRAS ? (
            <BarChart data={datosBarras} ariaLabel={`Ventas por día, ${nombreVista}`} formatAxis={axisSoles} />
          ) : (
            <LineChart
              etiquetas={filas.map((f) => etiquetaDia(f.dia, conAnio))}
              series={seriesLinea}
              ariaLabel={`Ventas por día, ${nombreVista}`}
              formatAxis={axisSoles}
              formatValue={(v) => formatSoles(v)}
            />
          )}
        </PanelCard>

        <PanelCard
          titulo={`Objetivo diario · ${nombreVista}`}
          subtitulo="Lo ve todo el equipo con acceso a Finanzas."
          acciones={
            !editando &&
            objetivoCargado && (
              <button type="button" className={claseBotonSecundario} onClick={abrirEditor}>
                <Target className="h-3.5 w-3.5" aria-hidden /> {hayObjetivo(objetivo) ? "Cambiar objetivo" : "Poner objetivo"}
              </button>
            )
          }
        >
          {editando ? (
            <form onSubmit={guardarObjetivo} className="space-y-2">
              <label htmlFor="objetivo-dia" className="block text-xs font-semibold text-pc-text">
                Objetivo de ventas por día (S/)
              </label>
              <input
                id="objetivo-dia"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                className={cn(claseInput, "w-40 tabular-nums")}
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={claseBotonPrimario}>
                  Guardar objetivo
                </button>
                {hayObjetivo(objetivo) && (
                  <button
                    type="button"
                    className={claseBotonSecundario}
                    onClick={() => {
                      guardar(null);
                      setEditando(false);
                    }}
                  >
                    Quitar objetivo
                  </button>
                )}
                <button type="button" className={claseBotonSecundario} onClick={() => setEditando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : !hayObjetivo(objetivo) ? (
            <p className="text-xs text-pc-text-muted">
              Sin objetivo para {esTodos ? "todos los canales" : nombreVista}. Ponle uno para ver el avance de cada
              día.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <Dato
                label="Objetivo por día"
                valor={formatSoles(objetivo.ventasDia ?? objetivoDelDia(objetivo, hastaVisible))}
                sub={
                  objetivo.ventasDia === null && objetivo.metaVentasMes !== null
                    ? `Tu meta mensual anterior (${formatSoles(objetivo.metaVentasMes)}) repartida por los días del mes`
                    : undefined
                }
              />
              <Dato
                label="Días que lo cumplieron"
                valor={`${formatNumber(diasCumplidos)} de ${formatNumber(dias.length)}`}
              />
              <Dato
                className="col-span-2"
                label="Avance del periodo"
                valor={formatPercent(avancePeriodo)}
                sub={`${formatSoles(resumen.monto)} de ${formatSoles(objetivoPeriodo)}`}
              />
            </dl>
          )}
        </PanelCard>
      </div>

      <PanelCard
        titulo={`Seguimiento por día · ${nombreVista}`}
        subtitulo={
          esTodos
            ? `Publicidad: consumo de las cuentas conectadas${conPublicidad && publicidad.provisional ? " (el de hoy es provisional: la plataforma todavía lo puede corregir)" : ""}. Lo cargado en Gastos › Publicidad es mensual y está en Resultados.`
            : "La publicidad conectada no viene separada por canal: se ve en «Todos los canales». El detalle por tienda y canal está en Publicidad."
        }
      >
        {datos.cargando ? (
          <PanelSkeleton variant="tabla" label="seguimiento por día" />
        ) : (
          <AdminTable
            caption={`Ventas por día, ${nombreVista}`}
            columns={columnasDia}
            rows={[...filas].reverse()}
            getRowKey={(f) => f.dia}
            maxHeight={520}
            emptyMessage="El periodo elegido todavía no empieza"
            rowClassName={(f) => (f.dia === hoy ? "bg-pc-primary-soft/40" : undefined)}
            footer={{
              dia: "Total",
              pedidos: formatNumber(resumen.pedidos),
              unidades: formatNumber(resumen.unidades),
              ventas: formatSoles(resumen.monto),
              publicidad: publicidadTotal === null ? SIN_DATO : formatSoles(publicidadTotal),
              costo: formatSolesDecimales(costoPorVentaTotal),
              objetivo: objetivoPeriodo === null ? SIN_DATO : formatSoles(objetivoPeriodo),
              avance: formatPercent(avancePeriodo),
            }}
          />
        )}
        <p className="mt-2 text-[11px] text-pc-text-muted">
          Una venta es un pedido entregado y cuenta en el día en que se entregó.
        </p>
        <NotaSinHistorial cantidad={servidor.calidad.entregasSinHistorial} className="mt-1" />
      </PanelCard>

      <PanelCard
        titulo="Por canal"
        subtitulo="Todos los canales que aparecen en las ventas del periodo. Toca uno para ver su seguimiento por día."
      >
        {datos.cargando ? (
          <PanelSkeleton variant="tabla" label="ventas por canal" />
        ) : (
          <AdminTable
            caption="Ventas por canal"
            columns={columnasCanal}
            rows={filasCanal}
            getRowKey={(f) => f.clave}
            emptyMessage="Sin ventas en el periodo"
            rowClassName={(f) => (f.clave === canal ? "bg-pc-primary-soft/40" : undefined)}
            footer={{
              canal: "Todos los canales",
              pedidos: formatNumber(totalCanales.pedidos),
              unidades: formatNumber(totalCanales.unidades),
              ventas: formatSoles(totalCanales.monto),
              participacion: totalCanales.monto > 0 ? "100%" : SIN_DATO,
              ticket: formatSoles(totalCanales.ticketPromedio),
            }}
          />
        )}
      </PanelCard>
    </div>
  );
}
