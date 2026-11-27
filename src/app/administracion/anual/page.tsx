"use client";

/**
 * Resumen anual (FEAT-34: C1, C2, C9, M5, M12).
 *
 * - Año = el del «Hasta» del periodo elegido (antes siempre el año calendario de hoy). Los meses futuros quedan
 *   vacíos y el mes en curso se mide hasta hoy (`useResultadosAnuales`).
 * - Cada mes es la misma cuenta que el resto del módulo (`calcularResultados`): costo por línea con aviso de ventas
 *   sin costo, día de ENTREGA en hora Lima (D1, calculado en ms-ventas: una sola consulta por el año), envíos = flete
 *   por pedido (D9), gastos repartidos por días y publicidad de una fuente.
 * - Margen del año ponderado: utilidad operativa del año ÷ ventas del año, no el promedio de los % de cada mes.
 * - Comparación año a la fecha contra el año anterior a la misma fecha (antes: 12 meses contra lo que iba del año).
 * - Proyección = ritmo diario del año a la fecha × días del año (antes contaba meses futuros con gastos cargados).
 * - Metas sin valores por defecto: sin meta no hay cumplimiento ni semáforo.
 */

import { Pencil } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { LineChart, type LineSeries } from "@/components/panel-control/charts/LineChart";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import type { SemaforoEstado } from "@/features/panel-control/shared/models/goal.model";
import { axisSoles } from "@/features/panel-control/shared/utils/chart";
import { calcularDelta } from "@/features/panel-control/shared/utils/delta";
import { evaluarAvance } from "@/features/panel-control/shared/utils/semaforo";
import { cn } from "@/lib/utils";
import { type Nivel, NivelDot, NivelPill } from "../_components/nivel";
import {
  AdminTable,
  Aviso,
  AvisoCostos,
  type ColumnaTabla,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  Dato,
  formatNumber,
  formatPercent,
  formatSoles,
  KpiCard,
  NotaFlete,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { type MetasAnuales, metaVentasMensual, useMetasAnuales } from "../_lib/metasStorage";
import {
  aDiaKey,
  type DiaKey,
  diasDelMes,
  diasEntre,
  etiquetaPeriodo,
  MESES_CORTOS,
  MESES_LARGOS,
  partes,
  sumarMeses,
} from "../_lib/periodo";
import type { EstadoPublicidad } from "../_lib/publicidad";
import type { Resultados } from "../_lib/resultados";
import { notaFlete } from "../_lib/servidor";
import { type ResultadoMes, useAdminContexto, useResultadosAnuales } from "../_lib/useResultados";

// ---- Semáforo ---------------------------------------------------------------------------------

const NIVEL: Record<SemaforoEstado, Nivel> = {
  cumple: "verde",
  cerca: "ambar",
  bajo: "rojo",
  sin_datos: "sin-datos",
};

const TEXTO_SEMAFORO: Record<SemaforoEstado, string> = {
  cumple: "Cumple",
  cerca: "Cerca",
  bajo: "Bajo la meta",
  sin_datos: "Sin datos",
};

/** Margen contra el objetivo (fracciones 0..1), con la misma tolerancia que el Panel (15 %). */
function evaluarMargen(valor: number | null, objetivo: number): SemaforoEstado {
  if (valor === null) return "sin_datos";
  if (valor >= objetivo) return "cumple";
  return valor >= objetivo * 0.85 ? "cerca" : "bajo";
}

// ---- Filas por mes ----------------------------------------------------------------------------

interface FilaMes {
  clave: string;
  mes: number;
  estado: "futuro" | "sin_datos" | "parcial" | "completo";
  /** Rótulo del tramo cuando el mes no está completo («hasta hoy», «hasta el 15»). */
  tramo: string | null;
  r: Resultados | null;
  /** Meta de ventas del tramo medido (meta mensual × días medidos ÷ días del mes). */
  metaVentas: number | null;
}

function tieneMovimiento(m: ResultadoMes): boolean {
  return m.tieneDatos || m.resultados.publicidad.total > 0 || m.resultados.envios > 0;
}

function armarFilas(meses: ResultadoMes[], metas: MetasAnuales, hoy: DiaKey): FilaMes[] {
  const metaMes = metaVentasMensual(metas);
  return meses.map((m) => {
    const clave = `${m.anio}-${String(m.mes).padStart(2, "0")}`;
    if (!m.rango) return { clave, mes: m.mes, estado: "futuro", tramo: null, r: null, metaVentas: null };
    const diasMes = diasDelMes(m.anio, m.mes);
    const diasMedidos = diasEntre(m.rango.desde, m.rango.hasta);
    const parcial = diasMedidos < diasMes;
    const tramo = parcial ? (m.rango.hasta === hoy ? "hasta hoy" : `hasta el ${partes(m.rango.hasta)[2]}`) : null;
    if (!tieneMovimiento(m)) return { clave, mes: m.mes, estado: "sin_datos", tramo, r: null, metaVentas: null };
    return {
      clave,
      mes: m.mes,
      estado: parcial ? "parcial" : "completo",
      tramo,
      r: m.resultados,
      metaVentas: metaMes !== null ? (metaMes * diasMedidos) / diasMes : null,
    };
  });
}

const vacio = <span className="text-pc-text-muted">{SIN_DATO}</span>;

function soles(valor: number | null | undefined, resaltarNegativo = false): ReactNode {
  if (valor === null || valor === undefined) return vacio;
  return <span className={cn(resaltarNegativo && valor < 0 && "text-pc-bad")}>{formatSoles(valor)}</span>;
}

// ---- Página -----------------------------------------------------------------------------------

export default function ResumenAnualPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const { companyId, hoy } = useAdminContexto();
  const anio = partes(toDate)[0];

  const actual = useResultadosAnuales(anio);
  // Año a la fecha contra el año anterior a la misma fecha.
  const anterior = useResultadosAnuales(anio - 1, { hastaDia: sumarMeses(actual.hasta, -12) });
  const [metas, setMetas, estadoMetas] = useMetasAnuales(companyId, anio);

  const finAnio = aDiaKey(anio, 12, 31);
  const diasAnio = diasEntre(aDiaKey(anio, 1, 1), finAnio);
  const diasMedidos = diasEntre(actual.desde, actual.hasta);
  const anioCerrado = actual.hasta === finAnio;
  const anioFuturo = actual.hasta < actual.desde;
  const total = actual.total;

  const proyeccion = useMemo(() => {
    if (diasMedidos <= 0) return { ventas: null, utilidad: null };
    const factor = diasAnio / diasMedidos;
    return { ventas: total.ventas * factor, utilidad: total.utilidadOperativa * factor };
  }, [diasAnio, diasMedidos, total.ventas, total.utilidadOperativa]);

  const filas = armarFilas(actual.meses, metas, hoy);
  const medidos = actual.meses.filter((m) => m.rango !== null);
  const hayDatos = medidos.some(tieneMovimiento);
  const anteriorConDatos = anterior.meses.some((m) => m.rango !== null && tieneMovimiento(m));
  const rangoAnterior = etiquetaPeriodo(anterior.desde, anterior.hasta);
  const deltas = !anterior.cargando && anteriorConDatos;

  const rotulo = (
    <p className="text-xs text-pc-text-muted">
      Año <span className="font-semibold text-pc-text">{anio}</span>: el del último día del periodo elegido (
      {etiquetaPeriodo(fromDate, toDate)}). Para ver otro año, cambia el periodo arriba.
    </p>
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

  if (actual.error) {
    return (
      <div className="space-y-3.5">
        {rotulo}
        <PanelError error={actual.error as Error} />
      </div>
    );
  }

  if (actual.cargando) {
    return (
      <div className="space-y-3.5">
        {rotulo}
        <PanelSkeleton variant="kpis" label="resumen anual" />
        <PanelSkeleton variant="tabla" label="resultados por mes" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {rotulo}
      <AvisoCostos costo={total.costo} />
      <NotaPublicidad estado={actual.publicidad.estado} />
      {!hayDatos && (
        <Aviso tono="info" titulo={`Todavía no hay ventas entregadas ni gastos en ${anio}`}>
          Cuando haya, vas a ver acá el resultado de cada mes.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={`Ventas ${anio}`}
          value={formatSoles(total.ventas)}
          delta={deltas ? calcularDelta(total.ventas, anterior.total.ventas) : undefined}
          sub={`${etiquetaPeriodo(actual.desde, actual.hasta)} · ${formatNumber(total.pedidos)} ventas · sin IGV ${formatSoles(total.ventasSinIgv)}`}
        />
        <KpiCard
          label="Utilidad operativa"
          value={<span className={cn(total.utilidadOperativa < 0 && "text-pc-bad")}>{formatSoles(total.utilidadOperativa)}</span>}
          delta={deltas ? calcularDelta(total.utilidadOperativa, anterior.total.utilidadOperativa) : undefined}
          sub="Ventas − costo − comisiones, envíos y publicidad − gastos fijos"
        />
        <KpiCard
          label="Margen operativo"
          value={formatPercent(total.margenOperativo, 1)}
          sub={
            <>
              Utilidad del año ÷ ventas del año.
              {deltas && ` ${anio - 1} a la misma fecha: ${formatPercent(anterior.total.margenOperativo, 1)}.`}
            </>
          }
        />
        <KpiCard
          label={anioCerrado ? `Cierre ${anio}` : `Proyección ${anio}`}
          value={formatSoles(anioCerrado ? total.ventas : proyeccion.ventas)}
          sub={
            anioCerrado
              ? "Año cerrado: es el total real"
              : `Utilidad proyectada ${formatSoles(proyeccion.utilidad)} · al ritmo de ${formatNumber(diasMedidos)} días`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard titulo="Ventas y utilidad por mes" subtitulo={`Meses medidos de ${anio}; el mes en curso, hasta hoy`}>
          <GraficoAnual anio={anio} medidos={medidos} anteriores={anterior.meses} />
        </PanelCard>
        <MetasCard
          anio={anio}
          metas={metas}
          setMetas={setMetas}
          estado={estadoMetas}
          total={total}
          proyeccion={proyeccion}
          anioCerrado={anioCerrado}
        />
      </div>

      <PanelCard
        titulo={`Resultados por mes de ${anio}`}
        subtitulo="Utilidad bruta = ventas − costo de producto − merma. Los meses que faltan quedan vacíos."
      >
        <TablaMeses filas={filas} total={total} metas={metas} diasMedidos={diasMedidos} diasAnio={diasAnio} />
        <NotaFlete nota={notaFlete(actual.flete)} className="mt-2" />
      </PanelCard>

      <PanelCard
        titulo={`${anio} contra ${anio - 1}, a la misma fecha`}
        subtitulo={`${etiquetaPeriodo(actual.desde, actual.hasta)} contra ${rangoAnterior}`}
      >
        {anterior.cargando ? (
          <PanelSkeleton variant="tabla" label="comparación con el año anterior" />
        ) : !anteriorConDatos ? (
          <Aviso tono="info">No hay ventas ni gastos de {anio - 1} hasta esa fecha para comparar.</Aviso>
        ) : (
          <Comparativo anio={anio} actual={total} anterior={anterior.total} />
        )}
      </PanelCard>
    </div>
  );
}

// ---- Bloques ----------------------------------------------------------------------------------

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

function GraficoAnual({
  anio,
  medidos,
  anteriores,
}: {
  anio: number;
  medidos: ResultadoMes[];
  anteriores: ResultadoMes[];
}) {
  if (medidos.length < 2) {
    return <p className="text-xs text-pc-text-muted">El gráfico aparece desde el segundo mes del año.</p>;
  }
  const hayPerdida = medidos.some((m) => m.resultados.utilidadOperativa < 0);
  const anteriorPorMes = new Map(anteriores.filter((m) => m.rango).map((m) => [m.mes, m.resultados.ventas]));
  const series: LineSeries[] = [
    {
      id: "ventas",
      nombre: `Ventas ${anio}`,
      color: "var(--pc-series-1)",
      valores: medidos.map((m) => m.resultados.ventas),
    },
    {
      id: "utilidad",
      nombre: "Utilidad operativa",
      color: "var(--pc-series-2)",
      valores: medidos.map((m) => Math.max(0, m.resultados.utilidadOperativa)),
    },
  ];
  if (anteriorPorMes.size > 0) {
    series.push({
      id: "anterior",
      nombre: `Ventas ${anio - 1}`,
      color: "var(--pc-series-3)",
      valores: medidos.map((m) => anteriorPorMes.get(m.mes) ?? 0),
      punteada: true,
    });
  }
  return (
    <>
      <LineChart
        etiquetas={medidos.map((m) => MESES_CORTOS[m.mes - 1])}
        series={series}
        ariaLabel={`Ventas y utilidad operativa por mes de ${anio}`}
        formatAxis={axisSoles}
        formatValue={formatSoles}
      />
      {hayPerdida && (
        <p className="mt-1 text-[11px] text-pc-text-muted">
          Los meses con pérdida se dibujan en S/ 0; el monto exacto está en la tabla.
        </p>
      )}
    </>
  );
}

function TablaMeses({
  filas,
  total,
  metas,
  diasMedidos,
  diasAnio,
}: {
  filas: FilaMes[];
  total: Resultados;
  metas: MetasAnuales;
  diasMedidos: number;
  diasAnio: number;
}) {
  const numero = (f: FilaMes, valor: (r: Resultados) => number) => (f.r ? valor(f.r) : null);
  const columnas: ColumnaTabla<FilaMes>[] = [
    {
      id: "mes",
      header: "Mes",
      align: "left",
      cell: (f) => (
        <span className={cn(f.estado === "futuro" && "text-pc-text-muted")}>
          <span className="capitalize">{MESES_LARGOS[f.mes - 1]}</span>
          {f.tramo && <span className="ml-1 text-[11px] text-pc-text-muted">({f.tramo})</span>}
          {f.estado === "futuro" && <span className="ml-1 text-[11px]">(por venir)</span>}
        </span>
      ),
    },
    {
      id: "ventas",
      header: "Ventas",
      cell: (f) => soles(numero(f, (r) => r.ventas)),
      sortValue: (f) => numero(f, (r) => r.ventas),
    },
    {
      id: "costo",
      header: "Costo",
      cell: (f) => soles(numero(f, (r) => r.costoProducto)),
      sortValue: (f) => numero(f, (r) => r.costoProducto),
    },
    {
      id: "bruta",
      header: "Utilidad bruta",
      cell: (f) => soles(numero(f, (r) => r.utilidadBruta), true),
      sortValue: (f) => numero(f, (r) => r.utilidadBruta),
    },
    {
      id: "variables",
      header: "Comisiones y envíos",
      cell: (f) => soles(numero(f, (r) => r.comisiones + r.envios)),
      sortValue: (f) => numero(f, (r) => r.comisiones + r.envios),
    },
    {
      id: "publicidad",
      header: "Publicidad",
      cell: (f) => soles(numero(f, (r) => r.publicidad.total)),
      sortValue: (f) => numero(f, (r) => r.publicidad.total),
    },
    {
      id: "fijos",
      header: "Gastos fijos",
      cell: (f) => soles(numero(f, (r) => r.gastosFijos)),
      sortValue: (f) => numero(f, (r) => r.gastosFijos),
    },
    {
      id: "operativa",
      header: "Utilidad operativa",
      cell: (f) => soles(numero(f, (r) => r.utilidadOperativa), true),
      sortValue: (f) => numero(f, (r) => r.utilidadOperativa),
    },
    {
      id: "margen",
      header: "Margen",
      cell: (f) => (f.r && f.r.margenOperativo !== null ? formatPercent(f.r.margenOperativo, 1) : vacio),
      sortValue: (f) => f.r?.margenOperativo ?? null,
    },
  ];

  const objetivo = metas.margenObjetivoPct !== null ? metas.margenObjetivoPct / 100 : null;
  const metaAlaFecha =
    metas.ventasAnual !== null && diasAnio > 0 ? (metas.ventasAnual * diasMedidos) / diasAnio : null;

  if (metas.ventasAnual !== null) {
    columnas.push({
      id: "vsMeta",
      header: "Vs meta de ventas",
      cell: (f) => {
        if (!f.r || !f.metaVentas) return vacio;
        const estado = evaluarAvance(f.r.ventas, f.metaVentas);
        return (
          <span className="inline-flex items-center gap-1.5" title={TEXTO_SEMAFORO[estado]}>
            <NivelDot nivel={NIVEL[estado]} />
            {formatPercent(f.r.ventas / f.metaVentas)}
          </span>
        );
      },
      sortValue: (f) => (f.r && f.metaVentas ? f.r.ventas / f.metaVentas : null),
    });
  }
  if (objetivo !== null) {
    columnas.push({
      id: "vsMargen",
      header: "Vs margen objetivo",
      cell: (f) => {
        if (!f.r) return vacio;
        const estado = evaluarMargen(f.r.margenOperativo, objetivo);
        return (
          <span className="inline-flex items-center gap-1.5">
            <NivelDot nivel={NIVEL[estado]} />
            {TEXTO_SEMAFORO[estado]}
          </span>
        );
      },
    });
  }

  const footer: Partial<Record<string, ReactNode>> = {
    mes: "Año a la fecha",
    ventas: formatSoles(total.ventas),
    costo: formatSoles(total.costoProducto),
    bruta: soles(total.utilidadBruta, true),
    variables: formatSoles(total.comisiones + total.envios),
    publicidad: formatSoles(total.publicidad.total),
    fijos: formatSoles(total.gastosFijos),
    operativa: soles(total.utilidadOperativa, true),
    margen: formatPercent(total.margenOperativo, 1),
    vsMeta: metaAlaFecha ? formatPercent(total.ventas / metaAlaFecha) : SIN_DATO,
    vsMargen: objetivo !== null ? TEXTO_SEMAFORO[evaluarMargen(total.margenOperativo, objetivo)] : "",
  };

  return (
    <AdminTable
      caption="Resultados por mes del año"
      columns={columnas}
      rows={filas}
      getRowKey={(f) => f.clave}
      footer={footer}
      rowClassName={(f) => (f.estado === "futuro" ? "text-pc-text-muted" : undefined)}
    />
  );
}

// ---- Metas ------------------------------------------------------------------------------------

interface FormMetas {
  ventas: string;
  utilidad: string;
  margen: string;
}

const aTexto = (valor: number | null) => (valor === null ? "" : String(valor));

function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function MetasCard({
  anio,
  metas,
  setMetas,
  estado,
  total,
  proyeccion,
  anioCerrado,
}: {
  anio: number;
  metas: MetasAnuales;
  setMetas: (metas: MetasAnuales) => void;
  estado: { cargando: boolean; guardando: boolean; error: unknown };
  total: Resultados;
  proyeccion: { ventas: number | null; utilidad: number | null };
  anioCerrado: boolean;
}) {
  const [form, setForm] = useState<FormMetas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abrir = () => {
    setError(null);
    setForm({
      ventas: aTexto(metas.ventasAnual),
      utilidad: aTexto(metas.profitAnual),
      margen: aTexto(metas.margenObjetivoPct),
    });
  };

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!form) return;
    const margen = leerNumero(form.margen);
    if (margen !== null && margen >= 100) {
      setError("El margen objetivo tiene que ser menor a 100 %.");
      return;
    }
    setMetas({ ventasAnual: leerNumero(form.ventas), profitAnual: leerNumero(form.utilidad), margenObjetivoPct: margen });
    setForm(null);
  };

  return (
    <PanelCard
      titulo={`Metas ${anio}`}
      subtitulo="Las ve todo el equipo con acceso a Finanzas. Un campo vacío es «sin meta»."
      acciones={
        // Sin las metas cargadas no se edita: guardar el formulario vacío borraría las del servidor.
        !form &&
        !estado.cargando &&
        !estado.error && (
          <button type="button" className={claseBotonSecundario} onClick={abrir}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Editar metas
          </button>
        )
      }
    >
      {!!estado.error && !form && (
        <p role="alert" className="mb-2 text-xs text-pc-bad">
          No se pudieron leer las metas. Recarga la página para editarlas.
        </p>
      )}
      {form ? (
        <form onSubmit={guardar} className="space-y-3" aria-label={`Editar metas ${anio}`}>
          <CampoMeta
            id="meta-ventas"
            label="Ventas del año (S/)"
            value={form.ventas}
            onChange={(ventas) => setForm({ ...form, ventas })}
          />
          <CampoMeta
            id="meta-utilidad"
            label="Utilidad operativa del año (S/)"
            value={form.utilidad}
            onChange={(utilidad) => setForm({ ...form, utilidad })}
          />
          <CampoMeta
            id="meta-margen"
            label="Margen operativo objetivo (%)"
            value={form.margen}
            onChange={(margen) => setForm({ ...form, margen })}
          />
          {error && (
            <p role="alert" className="text-xs text-pc-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={claseBotonPrimario}>
              Guardar metas
            </button>
            <button type="button" className={claseBotonSecundario} onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <dl className="space-y-4">
          <AvanceMeta
            label="Ventas"
            logrado={total.ventas}
            meta={metas.ventasAnual}
            proyectado={anioCerrado ? total.ventas : proyeccion.ventas}
            anioCerrado={anioCerrado}
          />
          <AvanceMeta
            label="Utilidad operativa"
            logrado={total.utilidadOperativa}
            meta={metas.profitAnual}
            proyectado={anioCerrado ? total.utilidadOperativa : proyeccion.utilidad}
            anioCerrado={anioCerrado}
          />
          <MargenMeta margen={total.margenOperativo} objetivoPct={metas.margenObjetivoPct} />
        </dl>
      )}
    </PanelCard>
  );
}

function CampoMeta({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-pc-text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        placeholder="Sin meta"
        className={cn(claseInput, "w-full")}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
      />
    </div>
  );
}

function SinMeta({ label }: { label: string }) {
  return <Dato label={label} valor={<span className="text-pc-text-muted">Sin meta</span>} sub="Cárgala con «Editar metas»" />;
}

function AvanceMeta({
  label,
  logrado,
  meta,
  proyectado,
  anioCerrado,
}: {
  label: string;
  logrado: number;
  meta: number | null;
  proyectado: number | null;
  anioCerrado: boolean;
}) {
  if (meta === null) return <SinMeta label={label} />;
  const avance = logrado / meta;
  const estado = evaluarAvance(proyectado, meta);
  return (
    <div>
      <Dato
        label={label}
        valor={`${formatPercent(avance)} de la meta`}
        sub={`${formatSoles(logrado)} de ${formatSoles(meta)}`}
      />
      <div
        role="progressbar"
        aria-label={`Avance de ${label.toLowerCase()} contra la meta`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, Math.max(0, avance)) * 100)}
        className="mt-1.5 h-2 overflow-hidden rounded-md bg-pc-border-soft"
      >
        <span
          className="block h-full rounded-md bg-pc-primary"
          style={{ width: `${Math.min(1, Math.max(0, avance)) * 100}%` }}
        />
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-pc-text-muted">
        <NivelPill nivel={NIVEL[estado]}>{TEXTO_SEMAFORO[estado]}</NivelPill>
        {anioCerrado
          ? "Año cerrado"
          : `A este ritmo cierra en ${formatSoles(proyectado)} (${formatPercent(proyectado !== null ? proyectado / meta : null)} de la meta)`}
      </p>
    </div>
  );
}

function MargenMeta({ margen, objetivoPct }: { margen: number | null; objetivoPct: number | null }) {
  if (objetivoPct === null) return <SinMeta label="Margen operativo" />;
  const estado = evaluarMargen(margen, objetivoPct / 100);
  return (
    <div>
      <Dato
        label="Margen operativo"
        valor={formatPercent(margen, 1)}
        sub={`Objetivo ${formatPercent(objetivoPct / 100, 1)}`}
      />
      <p className="mt-1.5">
        <NivelPill nivel={NIVEL[estado]}>{TEXTO_SEMAFORO[estado]}</NivelPill>
      </p>
    </div>
  );
}

// ---- Comparación ------------------------------------------------------------------------------

interface FilaComparada {
  clave: string;
  concepto: string;
  actual: number | null;
  anterior: number | null;
  tipo: "soles" | "margen";
  sentido: "mas_es_mejor" | "menos_es_mejor";
}

function Comparativo({ anio, actual, anterior }: { anio: number; actual: Resultados; anterior: Resultados }) {
  const filas: FilaComparada[] = [
    { clave: "ventas", concepto: "Ventas", actual: actual.ventas, anterior: anterior.ventas, tipo: "soles", sentido: "mas_es_mejor" },
    {
      clave: "costo",
      concepto: "Costo de producto",
      actual: actual.costoProducto,
      anterior: anterior.costoProducto,
      tipo: "soles",
      sentido: "menos_es_mejor",
    },
    {
      clave: "bruta",
      concepto: "Utilidad bruta",
      actual: actual.utilidadBruta,
      anterior: anterior.utilidadBruta,
      tipo: "soles",
      sentido: "mas_es_mejor",
    },
    {
      clave: "publicidad",
      concepto: "Publicidad",
      actual: actual.publicidad.total,
      anterior: anterior.publicidad.total,
      tipo: "soles",
      sentido: "menos_es_mejor",
    },
    {
      clave: "fijos",
      concepto: "Gastos fijos",
      actual: actual.gastosFijos,
      anterior: anterior.gastosFijos,
      tipo: "soles",
      sentido: "menos_es_mejor",
    },
    {
      clave: "operativa",
      concepto: "Utilidad operativa",
      actual: actual.utilidadOperativa,
      anterior: anterior.utilidadOperativa,
      tipo: "soles",
      sentido: "mas_es_mejor",
    },
    {
      clave: "margen",
      concepto: "Margen operativo",
      actual: actual.margenOperativo,
      anterior: anterior.margenOperativo,
      tipo: "margen",
      sentido: "mas_es_mejor",
    },
  ];

  const valor = (f: FilaComparada, v: number | null) =>
    f.tipo === "margen" ? formatPercent(v, 1) : soles(v, f.clave === "operativa" || f.clave === "bruta");

  const variacion = (f: FilaComparada): ReactNode => {
    if (f.tipo === "margen") {
      if (f.actual === null || f.anterior === null) return vacio;
      const puntos = (f.actual - f.anterior) * 100;
      return (
        <span className={cn(puntos > 0 ? "text-pc-ok" : puntos < 0 ? "text-pc-bad" : undefined)}>
          {`${puntos > 0 ? "+" : puntos < 0 ? "−" : ""}${Math.abs(puntos).toFixed(1)} pts`}
        </span>
      );
    }
    const delta = calcularDelta(f.actual, f.anterior, f.sentido);
    if (delta.variacion === null) return vacio;
    return (
      <span className={cn(delta.tono === "bueno" && "text-pc-ok", delta.tono === "malo" && "text-pc-bad")}>
        {`${delta.variacion > 0 ? "+" : delta.variacion < 0 ? "−" : ""}${formatPercent(Math.abs(delta.variacion), 1)}`}
      </span>
    );
  };

  return (
    <AdminTable
      caption={`Año ${anio} a la fecha contra ${anio - 1} a la misma fecha`}
      ordenable={false}
      columns={[
        { id: "concepto", header: "Concepto", align: "left", cell: (f) => f.concepto },
        { id: "actual", header: String(anio), cell: (f) => valor(f, f.actual) },
        { id: "anterior", header: String(anio - 1), cell: (f) => valor(f, f.anterior) },
        { id: "variacion", header: "Variación", cell: variacion },
      ]}
      rows={filas}
      getRowKey={(f) => f.clave}
    />
  );
}
