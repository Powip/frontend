"use client";

/**
 * Resultados › Utilidad y margen (FEAT-34).
 *
 * No repite la cascada de Resumen: muestra los márgenes, cuánto de cada venta se va en cada costo y el margen por
 * canal. Todo sale de la cuenta única de `_lib/resultados.ts`, así que los montos cuadran con Resumen.
 *
 * - Márgenes como fracciones de las ventas con IGV (la misma base que el estado de resultados).
 * - Por canal solo se reparte lo que el pedido trae (costo de producto y comisión); envíos, publicidad, merma y
 *   gastos fijos no tienen canal y se aclara en pantalla.
 */

import { useMemo } from "react";
import { HBarList, type HBarRow } from "@/components/panel-control/charts/HBarList";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  AdminTable,
  AvisoCostos,
  type ColumnaTabla,
  formatNumber,
  formatPercent,
  formatSoles,
  KpiCard,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
  SubTitulo,
} from "../_components/ui";
import { nombreCanal } from "../_lib/canales";
import { CATEGORIAS_FIJAS, NOMBRE_CATEGORIA, type Resultados } from "../_lib/resultados";
import { useResultadosPeriodo } from "../_lib/useResultados";
import {
  type PedidoAdmin,
  type ResumenVentas,
  resumirVentas,
  ventasPorCanal,
} from "../_lib/ventas";

interface FilaCanal {
  clave: string;
  nombre: string;
  pedidos: number;
  ventas: number;
  costo: number;
  comisiones: number;
  sinCosto: number;
  margenBruto: number | null;
  margenComisiones: number | null;
}

function filaDe(clave: string, nombre: string, v: ResumenVentas): FilaCanal {
  return {
    clave,
    nombre,
    pedidos: v.pedidos,
    ventas: v.monto,
    costo: v.costo,
    comisiones: v.comisiones,
    sinCosto: v.sinCosto.pedidos,
    margenBruto: v.monto > 0 ? (v.monto - v.costo) / v.monto : null,
    margenComisiones: v.monto > 0 ? (v.monto - v.costo - v.comisiones) / v.monto : null,
  };
}

function filasPorCanal(pedidos: PedidoAdmin[]): FilaCanal[] {
  return [...ventasPorCanal(pedidos).entries()]
    .map(([clave, v]) => filaDe(clave, nombreCanal(clave), v))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre));
}

/** Margen con «≤» cuando hay ventas sin costo: el margen real es menor. */
function Margen({ valor, sinCosto }: { valor: number | null; sinCosto: number }) {
  if (valor === null) return <span className="text-pc-text-muted">{SIN_DATO}</span>;
  if (sinCosto > 0) {
    return (
      <span
        className="text-pc-text-muted"
        title={`${sinCosto} ${sinCosto === 1 ? "venta" : "ventas"} sin costo cargado: el margen real es menor`}
      >
        ≤ {formatPercent(valor, 1)}
      </span>
    );
  }
  return <>{formatPercent(valor, 1)}</>;
}

const COLUMNAS_CANAL: ColumnaTabla<FilaCanal>[] = [
  {
    id: "canal",
    header: "Canal",
    align: "left",
    cell: (f) => f.nombre,
    sortValue: (f) => f.nombre,
  },
  {
    id: "pedidos",
    header: "Pedidos",
    cell: (f) => formatNumber(f.pedidos),
    sortValue: (f) => f.pedidos,
  },
  {
    id: "ventas",
    header: "Ventas",
    cell: (f) => formatSoles(f.ventas),
    sortValue: (f) => f.ventas,
  },
  {
    id: "costo",
    header: "Costo de producto",
    cell: (f) => (
      <>
        {formatSoles(f.costo)}
        {f.sinCosto > 0 && (
          <span className="ml-1 text-[11px] text-pc-warn">({f.sinCosto} sin costo)</span>
        )}
      </>
    ),
    sortValue: (f) => f.costo,
  },
  {
    id: "comisiones",
    header: "Comisiones",
    cell: (f) => formatSoles(f.comisiones),
    sortValue: (f) => f.comisiones,
  },
  {
    id: "margen_bruto",
    header: "Margen bruto",
    cell: (f) => <Margen valor={f.margenBruto} sinCosto={f.sinCosto} />,
    sortValue: (f) => f.margenBruto,
  },
  {
    id: "margen_comisiones",
    header: "Margen tras comisiones",
    cell: (f) => <Margen valor={f.margenComisiones} sinCosto={f.sinCosto} />,
    sortValue: (f) => f.margenComisiones,
  },
];

const COLOR_VARIABLES = "var(--pc-series-1)";
const COLOR_FIJOS = "var(--pc-series-3)";

function filasVariables(r: Resultados): HBarRow[] {
  return [
    { key: "costo", label: "Costo de producto", value: r.costoProducto },
    { key: "merma", label: "Merma", value: r.merma },
    { key: "comisiones", label: "Comisiones de canal", value: r.comisiones },
    { key: "envios", label: "Envíos", value: r.envios },
    { key: "publicidad", label: "Publicidad", value: r.publicidad.total },
  ].map((fila) => ({ ...fila, barColor: COLOR_VARIABLES }));
}

function filasFijos(r: Resultados): HBarRow[] {
  return CATEGORIAS_FIJAS.map((categoria) => ({
    key: categoria,
    label: NOMBRE_CATEGORIA[categoria],
    value: r.fijosPorCategoria[categoria],
    barColor: COLOR_FIJOS,
  })).filter((fila) => fila.value > 0);
}

export default function UtilidadPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const datos = useResultadosPeriodo(fromDate, toDate);
  const canales = useMemo(() => filasPorCanal(datos.pedidos), [datos.pedidos]);
  const totalCanales = useMemo(
    () => filaDe("total", "Total", resumirVentas(datos.pedidos)),
    [datos.pedidos],
  );

  if (datos.error) {
    return <PanelError error={datos.error instanceof Error ? datos.error : null} />;
  }
  if (datos.cargando) {
    return (
      <div className="space-y-3.5">
        <PanelSkeleton variant="kpis" label="márgenes del periodo" />
        <PanelSkeleton variant="tabla" label="margen por canal" />
      </div>
    );
  }

  const r = datos.resultados;
  const variables = filasVariables(r);
  const fijos = filasFijos(r);
  const totalVariables = r.costoProducto + r.merma + r.gastosVariables;
  const pct = (monto: number) => formatPercent(r.ventas ? monto / r.ventas : null, 1);

  return (
    <div className="space-y-3.5">
      <AvisoCostos costo={r.costo} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Ventas"
          value={formatSoles(r.ventas)}
          sub="Base de los márgenes (con IGV)"
        />
        <KpiCard
          label="Margen bruto"
          value={formatPercent(r.margenBruto, 1)}
          sub={`Utilidad bruta ${formatSoles(r.utilidadBruta)} · ventas − costo de producto − merma`}
        />
        <KpiCard
          label="Margen de contribución"
          value={formatPercent(r.margenContribucion, 1)}
          sub={`Contribución ${formatSoles(r.contribucion)} · después de comisiones, envíos y publicidad`}
        />
        <KpiCard
          label="Margen operativo"
          value={formatPercent(r.margenOperativo, 1)}
          sub={`Utilidad operativa ${formatSoles(r.utilidadOperativa)} · después de gastos fijos`}
        />
      </div>

      <PanelCard
        titulo="Estructura de costos"
        subtitulo="Cuánto de las ventas se va en cada costo. El % es sobre las ventas con IGV."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SubTitulo>Costos variables · suben con cada venta</SubTitulo>
              <span className="text-xs font-semibold tabular-nums text-pc-text">
                {formatSoles(totalVariables)} · {pct(totalVariables)}
              </span>
            </div>
            <HBarList
              ariaLabel="Costos variables como porcentaje de las ventas"
              rows={variables}
              formatValue={formatSoles}
              total={r.ventas}
            />
            {r.costo.sinCostoPedidos > 0 && (
              <p className="text-[11px] text-pc-warn">
                El costo de producto solo suma las ventas que lo tienen cargado.
              </p>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SubTitulo>Gastos fijos · se pagan aunque no vendas</SubTitulo>
              <span className="text-xs font-semibold tabular-nums text-pc-text">
                {formatSoles(r.gastosFijos)} · {pct(r.gastosFijos)}
              </span>
            </div>
            {fijos.length > 0 ? (
              <HBarList
                ariaLabel="Gastos fijos por categoría como porcentaje de las ventas"
                rows={fijos}
                formatValue={formatSoles}
                total={r.ventas}
              />
            ) : (
              <p className="text-xs text-pc-text-muted">
                Sin gastos fijos cargados en el periodo. Cárgalos en Costos › Gastos y costos.
              </p>
            )}
            <p className="text-[11px] text-pc-text-muted">
              Gasto mensual × días del periodo ÷ días del mes.
            </p>
          </div>
        </div>
        <p className="mt-4 border-t border-pc-border-soft pt-3 text-xs text-pc-text">
          Costos y gastos:{" "}
          <b className="tabular-nums">{formatSoles(totalVariables + r.gastosFijos)}</b> (
          {pct(totalVariables + r.gastosFijos)}) · queda de utilidad operativa{" "}
          <b className={r.utilidadOperativa < 0 ? "tabular-nums text-pc-bad" : "tabular-nums"}>
            {formatSoles(r.utilidadOperativa)}
          </b>{" "}
          ({pct(r.utilidadOperativa)})
        </p>
      </PanelCard>

      <PanelCard
        titulo="Margen por canal"
        subtitulo="Lo que deja cada canal después del costo de producto y de su comisión"
      >
        <AdminTable
          caption="Margen por canal"
          columns={COLUMNAS_CANAL}
          rows={canales}
          getRowKey={(f) => f.clave}
          emptyMessage="Sin ventas en el periodo"
          footer={
            canales.length > 1
              ? {
                  canal: "Total",
                  pedidos: formatNumber(totalCanales.pedidos),
                  ventas: formatSoles(totalCanales.ventas),
                  costo: formatSoles(totalCanales.costo),
                  comisiones: formatSoles(totalCanales.comisiones),
                  margen_bruto: (
                    <Margen valor={totalCanales.margenBruto} sinCosto={totalCanales.sinCosto} />
                  ),
                  margen_comisiones: (
                    <Margen
                      valor={totalCanales.margenComisiones}
                      sinCosto={totalCanales.sinCosto}
                    />
                  ),
                }
              : undefined
          }
        />
        <p className="mt-2 text-[11px] leading-relaxed text-pc-text-muted">
          Envíos, publicidad, merma y gastos fijos no se reparten por canal: el margen bruto de esta
          tabla no resta la merma y por eso puede diferir del de arriba. «≤» = hay ventas sin costo
          cargado y el margen real es menor.
        </p>
      </PanelCard>
    </div>
  );
}
