"use client";

/**
 * Flujo de caja estimado (FEAT-34: C8, M3, M6, M12).
 *
 * Antes era un estado de resultados con otro nombre (ventas − costo de lo vendido − gastos), del año de hoy, y perdía
 * la publicidad cargada en Gastos (la restaba de los gastos y sumaba la «inversión manual» del navegador).
 *
 * Ahora, mes a mes del año del periodo elegido (`useResultadosAnuales`):
 * - Entradas = ventas entregadas en el mes (por día de entrega; como si se cobraran ese mismo mes).
 * - Salidas = compra de mercadería (Gastos › categoría INVERSION del mes) + gastos fijos + publicidad
 *   (`resultados.publicidad.total`: cuentas conectadas + Gastos › Publicidad) + envíos (flete por pedido, D9) +
 *   comisiones de canal.
 * - No se resta el costo de producto: la compra de mercadería ya es esa salida (sería contarla dos veces).
 * - No incluye adelantos, lo que el courier todavía no liquidó, préstamos ni impuestos.
 */

import { type ReactNode, useMemo } from "react";
import { LineChart } from "@/components/panel-control/charts/LineChart";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import type { IGastoOperativo } from "@/interfaces/IAdmin";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  Aviso,
  type ColumnaTabla,
  formatSoles,
  KpiCard,
  NotaFlete,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { diasDelMes, diasEntre, etiquetaPeriodo, MESES_CORTOS, MESES_LARGOS, partes } from "../_lib/periodo";
import type { EstadoPublicidad } from "../_lib/publicidad";
import { notaFlete } from "../_lib/servidor";
import { type ResultadoMes, useAdminContexto, useResultadosAnuales } from "../_lib/useResultados";

interface FilaFlujo {
  clave: string;
  mes: number;
  futuro: boolean;
  tramo: string | null;
  entradas: number;
  compra: number;
  fijos: number;
  publicidad: number;
  envios: number;
  comisiones: number;
  salidas: number;
  neto: number;
  acumulado: number;
  conDatos: boolean;
}

/** Compra de mercadería cargada en Gastos para cada mes del año (monto completo del mes, sin repartir). */
function comprasPorMes(gastos: IGastoOperativo[], anio: number) {
  const meses = Array<number>(12).fill(0);
  for (const gasto of gastos) {
    if (gasto.categoria !== "INVERSION" || Number(gasto.anio) !== anio) continue;
    const mes = Number(gasto.mes);
    if (mes >= 1 && mes <= 12) meses[mes - 1] += Number(gasto.monto) || 0;
  }
  return meses;
}

function armarFilas(meses: ResultadoMes[], compras: number[], hoy: string): FilaFlujo[] {
  let acumulado = 0;
  return meses.map((m) => {
    const clave = `${m.anio}-${String(m.mes).padStart(2, "0")}`;
    if (!m.rango) {
      return {
        clave,
        mes: m.mes,
        futuro: true,
        tramo: null,
        entradas: 0,
        compra: 0,
        fijos: 0,
        publicidad: 0,
        envios: 0,
        comisiones: 0,
        salidas: 0,
        neto: 0,
        acumulado,
        conDatos: false,
      };
    }
    const r = m.resultados;
    const compra = compras[m.mes - 1] ?? 0;
    const salidas = compra + r.gastosFijos + r.publicidad.total + r.envios + r.comisiones;
    const neto = r.ventas - salidas;
    acumulado += neto;
    const parcial = diasEntre(m.rango.desde, m.rango.hasta) < diasDelMes(m.anio, m.mes);
    return {
      clave,
      mes: m.mes,
      futuro: false,
      tramo: parcial ? (m.rango.hasta === hoy ? "hasta hoy" : `hasta el ${partes(m.rango.hasta)[2]}`) : null,
      entradas: r.ventas,
      compra,
      fijos: r.gastosFijos,
      publicidad: r.publicidad.total,
      envios: r.envios,
      comisiones: r.comisiones,
      salidas,
      neto,
      acumulado,
      conDatos: m.tieneDatos || compra > 0 || r.publicidad.total > 0 || r.envios > 0,
    };
  });
}

const vacio = <span className="text-pc-text-muted">{SIN_DATO}</span>;

function soles(valor: number, resaltar = false): ReactNode {
  return <span className={cn(resaltar && valor < 0 && "text-pc-bad")}>{formatSoles(valor)}</span>;
}

export default function FlujoDeCajaPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const { hoy } = useAdminContexto();
  const anio = partes(toDate)[0];
  const datos = useResultadosAnuales(anio);

  const compras = useMemo(() => comprasPorMes(datos.gastosCrudos ?? [], anio), [datos.gastosCrudos, anio]);
  const filas = armarFilas(datos.meses, compras, hoy);
  const medidas = filas.filter((f) => !f.futuro);
  const totales = medidas.reduce(
    (t, f) => ({
      entradas: t.entradas + f.entradas,
      compra: t.compra + f.compra,
      fijos: t.fijos + f.fijos,
      publicidad: t.publicidad + f.publicidad,
      envios: t.envios + f.envios,
      comisiones: t.comisiones + f.comisiones,
      salidas: t.salidas + f.salidas,
      neto: t.neto + f.neto,
    }),
    { entradas: 0, compra: 0, fijos: 0, publicidad: 0, envios: 0, comisiones: 0, salidas: 0, neto: 0 },
  );
  const anioFuturo = datos.hasta < datos.desde;

  const rotulo = (
    <p className="text-xs text-pc-text-muted">
      Año <span className="font-semibold text-pc-text">{anio}</span>: el del último día del periodo elegido (
      {etiquetaPeriodo(fromDate, toDate)}). Para ver otro año, cambia el periodo arriba.
    </p>
  );

  const nota = (
    <Aviso tono="info" titulo="Flujo de caja estimado">
      <p>
        <b>Entradas</b>: las ventas entregadas en cada mes, como si se cobraran ese mismo mes. <b>Salidas</b>: la
        compra de mercadería, los gastos fijos y la publicidad cargados en Gastos (más el consumo de las cuentas de
        publicidad conectadas), los envíos (flete por pedido) y las comisiones de canal. El mes en curso se mide hasta
        hoy.
      </p>
      <p className="mt-1">
        No se resta el costo de lo vendido: la compra de mercadería ya es esa salida y sería contarla dos veces. No
        incluye adelantos de pedidos que todavía no se entregaron, lo que el courier aún no te liquidó, préstamos ni
        impuestos.
      </p>
    </Aviso>
  );

  if (anioFuturo) {
    return (
      <div className="space-y-3.5">
        {rotulo}
        <Aviso tono="info" titulo={`${anio} todavía no empezó`}>
          No hay meses cerrados ni en curso para mostrar.
        </Aviso>
      </div>
    );
  }

  if (datos.error) {
    return (
      <div className="space-y-3.5">
        {rotulo}
        <PanelError error={datos.error as Error} />
      </div>
    );
  }

  if (datos.cargando) {
    return (
      <div className="space-y-3.5">
        {rotulo}
        <PanelSkeleton variant="kpis" label="flujo de caja" />
        <PanelSkeleton variant="tabla" label="flujo por mes" />
      </div>
    );
  }

  const columnas: ColumnaTabla<FilaFlujo>[] = [
    {
      id: "mes",
      header: "Mes",
      align: "left",
      cell: (f) => (
        <span>
          <span className="capitalize">{MESES_LARGOS[f.mes - 1]}</span>
          {f.tramo && <span className="ml-1 text-[11px] text-pc-text-muted">({f.tramo})</span>}
          {f.futuro && <span className="ml-1 text-[11px] text-pc-text-muted">(por venir)</span>}
        </span>
      ),
    },
    ...(
      [
        ["entradas", "Entradas"],
        ["compra", "Compra de mercadería"],
        ["fijos", "Gastos fijos"],
        ["publicidad", "Publicidad"],
        ["envios", "Envíos"],
        ["comisiones", "Comisiones"],
        ["salidas", "Total salidas"],
      ] as const
    ).map(
      ([id, header]): ColumnaTabla<FilaFlujo> => ({
        id,
        header,
        cell: (f) => (f.futuro || !f.conDatos ? vacio : formatSoles(f[id])),
        sortValue: (f) => (f.futuro ? null : f[id]),
      }),
    ),
    {
      id: "neto",
      header: "Neto del mes",
      cell: (f) => (f.futuro || !f.conDatos ? vacio : soles(f.neto, true)),
      sortValue: (f) => (f.futuro ? null : f.neto),
    },
    {
      id: "acumulado",
      header: "Acumulado",
      cell: (f) => (f.futuro ? vacio : soles(f.acumulado, true)),
    },
  ];

  const sinCompras = totales.compra === 0;
  const graficables = medidas;

  return (
    <div className="space-y-3.5">
      {rotulo}
      {nota}
      <NotaPublicidad estado={datos.publicidad.estado} />
      {sinCompras && (
        <Aviso tono="warn" titulo={`No hay compras de mercadería cargadas en ${anio}`}>
          Carga lo que le pagas a tus proveedores en Costos › Gastos y costos, categoría «Compra de mercadería», para
          que el flujo lo descuente. Sin eso, el neto sale más alto de lo real.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Entradas"
          value={formatSoles(totales.entradas)}
          sub={`Ventas entregadas · ${etiquetaPeriodo(datos.desde, datos.hasta)}`}
        />
        <KpiCard
          label="Salidas"
          value={formatSoles(totales.salidas)}
          sub="Compra de mercadería, gastos fijos, publicidad, envíos y comisiones"
        />
        <KpiCard
          label="Neto del año"
          value={soles(totales.neto, true)}
          sub="Entradas − salidas, acumulado a la fecha"
        />
        <KpiCard
          label="Compra de mercadería"
          value={sinCompras ? SIN_DATO : formatSoles(totales.compra)}
          sub="Lo cargado en Gastos › Compra de mercadería"
        />
      </div>

      <PanelCard titulo="Entradas y salidas por mes" subtitulo={`Meses medidos de ${anio}; el mes en curso, hasta hoy`}>
        {graficables.length < 2 ? (
          <p className="text-xs text-pc-text-muted">El gráfico aparece desde el segundo mes del año.</p>
        ) : (
          <LineChart
            etiquetas={graficables.map((f) => MESES_CORTOS[f.mes - 1])}
            series={[
              { id: "entradas", nombre: "Entradas", color: "var(--pc-series-1)", valores: graficables.map((f) => f.entradas) },
              { id: "salidas", nombre: "Salidas", color: "var(--pc-series-2)", valores: graficables.map((f) => f.salidas) },
            ]}
            ariaLabel={`Entradas y salidas de caja por mes de ${anio}`}
            formatAxis={axisSoles}
            formatValue={formatSoles}
          />
        )}
      </PanelCard>

      <PanelCard
        titulo={`Flujo de caja ${anio}`}
        subtitulo={`Del 1 de enero al ${partes(datos.hasta)[2]} de ${MESES_LARGOS[partes(datos.hasta)[1] - 1]}. Los meses que faltan quedan vacíos.`}
      >
        <AdminTable
          caption={`Flujo de caja estimado por mes de ${anio}`}
          columns={columnas}
          rows={filas}
          getRowKey={(f) => f.clave}
          rowClassName={(f) => (f.futuro ? "text-pc-text-muted" : undefined)}
          footer={{
            mes: "Año a la fecha",
            entradas: formatSoles(totales.entradas),
            compra: formatSoles(totales.compra),
            fijos: formatSoles(totales.fijos),
            publicidad: formatSoles(totales.publicidad),
            envios: formatSoles(totales.envios),
            comisiones: formatSoles(totales.comisiones),
            salidas: formatSoles(totales.salidas),
            neto: soles(totales.neto, true),
            acumulado: soles(totales.neto, true),
          }}
        />
        <NotaFlete nota={notaFlete(datos.flete)} className="mt-2" />
      </PanelCard>
    </div>
  );
}

function NotaPublicidad({ estado }: { estado: EstadoPublicidad }) {
  if (estado === "sin_permiso") {
    return (
      <p className="text-xs text-pc-text-muted">
        No tienes permiso para ver las cuentas de publicidad conectadas: la publicidad incluye solo lo cargado en
        Gastos › Publicidad.
      </p>
    );
  }
  if (estado === "error" || estado === "sin_servicio") {
    return (
      <p className="text-xs text-pc-text-muted">
        No se pudo leer el consumo de las cuentas de publicidad conectadas: la publicidad incluye solo lo cargado en
        Gastos › Publicidad.
      </p>
    );
  }
  return null;
}
