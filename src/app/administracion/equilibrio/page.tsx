"use client";

/**
 * Resultados › Punto de equilibrio (FEAT-34).
 *
 * - Fijos y variables separados: fijos = gastos fijos del periodo (planilla, herramientas, courier propio, otros,
 *   repartidos por días); variables = costo de producto, merma, comisiones, envíos y publicidad. Antes los fees,
 *   el courier integrado y la publicidad se tomaban como fijos y el punto de equilibrio salía inflado (M2).
 * - Unidades reales (Σ cantidades de producto), no pedidos (C6).
 * - Simulador con campos que se pueden tipear: el texto vive en el estado y una recarga de datos no pisa lo editado.
 * - Sin gastos fijos cargados no se inventa un número: se avisa.
 */

import { useState } from "react";
import { ProgressBar } from "@/components/panel-control/charts/ProgressBar";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import {
  Aviso,
  AvisoCostos,
  claseBotonSecundario,
  claseInput,
  Dato,
  formatNumber,
  formatPercent,
  formatSoles,
  formatVeces,
  KpiCard,
  NotaFlete,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
  SubTitulo,
} from "../_components/ui";
import { CATEGORIAS_FIJAS, NOMBRE_CATEGORIA, type Resultados } from "../_lib/resultados";
import { notaFlete } from "../_lib/servidor";
import { useResultadosPeriodo } from "../_lib/useResultados";

// ---- Fijos y variables ------------------------------------------------------------------------

interface FilaCosto {
  clave: string;
  etiqueta: string;
  monto: number;
}

function TablaCostos({
  caption,
  filas,
  total,
  ventas,
}: {
  caption: string;
  filas: FilaCosto[];
  total: FilaCosto;
  ventas: number;
}) {
  const pct = (monto: number) => formatPercent(ventas ? monto / ventas : null, 1);
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-pc-text-muted">
          <th scope="col" className="py-1.5 text-left font-semibold">
            Concepto
          </th>
          <th scope="col" className="py-1.5 text-right font-semibold">
            S/
          </th>
          <th scope="col" className="py-1.5 text-right font-semibold">
            % ventas
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.clave} className="border-t border-pc-border-soft">
            <th scope="row" className="py-1.5 pl-1 text-left font-medium text-pc-text">
              {fila.etiqueta}
            </th>
            <td className="py-1.5 text-right tabular-nums">{formatSoles(fila.monto)}</td>
            <td className="py-1.5 pr-1 text-right tabular-nums text-pc-text-muted">
              {pct(fila.monto)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-pc-border-soft bg-pc-surface-muted font-bold">
          <th scope="row" className="py-1.5 pl-1 text-left">
            {total.etiqueta}
          </th>
          <td className="py-1.5 text-right tabular-nums">{formatSoles(total.monto)}</td>
          <td className="py-1.5 pr-1 text-right tabular-nums text-pc-text-muted">
            {pct(total.monto)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ---- Simulador --------------------------------------------------------------------------------

type Campo = "ticket" | "variables" | "fijos";

/** Lee un número tipeado: acepta coma o punto decimal y separador de miles. Vacío o inválido → null. */
function leerNumero(texto: string): number | null {
  let limpio = texto.trim().replace(/\s|S\/|%/g, "");
  if (!limpio) return null;
  limpio =
    limpio.includes(",") && limpio.includes(".")
      ? limpio.replace(/,/g, "")
      : limpio.replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

type Simulacion =
  | { estado: "incompleto" }
  | { estado: "error"; mensaje: string }
  | { estado: "ok"; ventas: number; pedidos: number; unidades: number | null };

function simular(
  ticket: number | null,
  pctVariables: number | null,
  fijos: number | null,
  unidadesPorPedido: number | null,
): Simulacion {
  if (ticket === null || pctVariables === null || fijos === null) return { estado: "incompleto" };
  if (ticket <= 0)
    return { estado: "error", mensaje: "El ticket promedio tiene que ser mayor a 0." };
  if (pctVariables < 0)
    return { estado: "error", mensaje: "El % de costos variables no puede ser negativo." };
  if (pctVariables >= 100) {
    return {
      estado: "error",
      mensaje: "Con costos variables de 100% o más, ninguna venta cubre los gastos fijos.",
    };
  }
  if (fijos < 0) return { estado: "error", mensaje: "Los gastos fijos no pueden ser negativos." };
  const ventas = fijos / (1 - pctVariables / 100);
  // El épsilon evita que 2,0000000001 pedidos se redondee a 3.
  const pedidos = Math.ceil(ventas / ticket - 1e-9);
  const unidades =
    unidadesPorPedido !== null ? Math.ceil(pedidos * unidadesPorPedido - 1e-9) : null;
  return { estado: "ok", ventas, pedidos, unidades };
}

function Simulador({ r }: { r: Resultados }) {
  // Solo se guarda lo que el usuario tipeó; el resto sale de los datos del periodo en cada render, así que una
  // recarga actualiza los campos que no tocó y respeta los que sí.
  const [editados, setEditados] = useState<Partial<Record<Campo, string>>>({});

  const porDefecto: Record<Campo, string> = {
    ticket: r.ticketPromedio !== null ? r.ticketPromedio.toFixed(2) : "",
    variables: r.margenContribucion !== null ? ((1 - r.margenContribucion) * 100).toFixed(2) : "",
    fijos: r.gastosFijos > 0 ? r.gastosFijos.toFixed(2) : "",
  };
  const texto = (campo: Campo) => editados[campo] ?? porDefecto[campo];
  const unidadesPorPedido = r.pedidos > 0 && r.unidades > 0 ? r.unidades / r.pedidos : null;
  const resultado = simular(
    leerNumero(texto("ticket")),
    leerNumero(texto("variables")),
    leerNumero(texto("fijos")),
    unidadesPorPedido,
  );

  const campos: { id: Campo; label: string; ayuda: string }[] = [
    {
      id: "ticket",
      label: "Ticket promedio (S/)",
      ayuda:
        r.ticketPromedio !== null
          ? `Del periodo: ${formatSoles(r.ticketPromedio)} por pedido`
          : "Sin ventas en el periodo",
    },
    {
      id: "variables",
      label: "Costos variables (% de la venta)",
      ayuda:
        r.margenContribucion !== null
          ? `Del periodo: ${formatPercent(1 - r.margenContribucion, 1)} (costo, merma, comisiones, envíos y publicidad)`
          : "Sin ventas en el periodo",
    },
    {
      id: "fijos",
      label: "Gastos fijos (S/)",
      ayuda:
        r.gastosFijos > 0
          ? `Del periodo: ${formatSoles(r.gastosFijos)}. Pon el gasto de un mes para simular un mes.`
          : "Sin gastos fijos cargados: escribe cuánto gastas al mes",
    },
  ];

  const hayEdiciones = Object.keys(editados).length > 0;

  return (
    <PanelCard
      titulo="Simulador"
      subtitulo="Cambia los números para ver cuánto tendrías que vender"
      acciones={
        hayEdiciones ? (
          <button type="button" className={claseBotonSecundario} onClick={() => setEditados({})}>
            Usar los datos del periodo
          </button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {campos.map((campo) => (
          <div key={campo.id} className="min-w-0">
            <label
              htmlFor={`simulador-${campo.id}`}
              className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted"
            >
              {campo.label}
            </label>
            <input
              id={`simulador-${campo.id}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={`${claseInput} mt-1 w-full tabular-nums`}
              value={texto(campo.id)}
              onChange={(e) => {
                const valor = e.target.value;
                setEditados((prev) => ({ ...prev, [campo.id]: valor }));
              }}
            />
            <p className="mt-1 text-[11px] text-pc-text-muted">{campo.ayuda}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-pc-border-soft pt-3">
        {resultado.estado === "ok" ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
            <Dato
              label="Ventas necesarias"
              valor={formatSoles(resultado.ventas)}
              sub="Gastos fijos ÷ (1 − % variables)"
            />
            <Dato
              label="Pedidos necesarios"
              valor={formatNumber(resultado.pedidos)}
              sub="Ventas ÷ ticket promedio"
            />
            <Dato
              label="Unidades necesarias"
              valor={
                resultado.unidades === null ? SIN_DATO : `≈ ${formatNumber(resultado.unidades)}`
              }
              sub={
                unidadesPorPedido !== null
                  ? `Con ${unidadesPorPedido.toLocaleString("es-PE", { maximumFractionDigits: 2 })} unidades por pedido, como en el periodo`
                  : "Sin unidades vendidas en el periodo"
              }
            />
          </dl>
        ) : resultado.estado === "error" ? (
          <p role="alert" className="text-xs font-semibold text-pc-bad">
            {resultado.mensaje}
          </p>
        ) : (
          <p className="text-xs text-pc-text-muted">Completa los tres campos para calcular.</p>
        )}
      </div>
    </PanelCard>
  );
}

// ---- Página -----------------------------------------------------------------------------------

export default function EquilibrioPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const datos = useResultadosPeriodo(fromDate, toDate);

  if (datos.error) {
    return <PanelError error={datos.error instanceof Error ? datos.error : null} />;
  }
  if (datos.cargando) {
    return (
      <div className="space-y-3.5">
        <PanelSkeleton variant="kpis" label="punto de equilibrio" />
        <PanelSkeleton variant="tabla" label="gastos fijos y variables" />
      </div>
    );
  }

  const r = datos.resultados;
  const sinFijos = r.gastosFijos <= 0;
  // Sin gastos fijos la cuenta da 0 («S/ 0 para no perder»): se muestra sin dato, no un número inventado.
  const pe: Resultados["puntoEquilibrio"] = sinFijos
    ? { ventas: null, unidades: null, avance: null }
    : r.puntoEquilibrio;
  const margenSeguridad =
    pe.ventas !== null && r.ventas > 0 ? (r.ventas - pe.ventas) / r.ventas : null;

  const variables: FilaCosto[] = [
    { clave: "costo", etiqueta: "Costo de producto", monto: r.costoProducto },
    { clave: "merma", etiqueta: "Merma", monto: r.merma },
    { clave: "comisiones", etiqueta: "Comisiones de canal", monto: r.comisiones },
    { clave: "envios", etiqueta: "Envíos (flete por pedido)", monto: r.envios },
    { clave: "publicidad", etiqueta: "Publicidad", monto: r.publicidad.total },
  ];
  const fijos: FilaCosto[] = CATEGORIAS_FIJAS.map((categoria) => ({
    clave: categoria,
    etiqueta: NOMBRE_CATEGORIA[categoria],
    monto: r.fijosPorCategoria[categoria],
  }));

  const motivoSinPe = sinFijos
    ? null
    : r.ventas <= 0
      ? "Sin ventas en el periodo: todavía no hay margen de contribución para calcularlo."
      : "La contribución es cero o negativa: los costos variables se comen toda la venta y ninguna venta cubre los gastos fijos.";

  return (
    <div className="space-y-3.5">
      <AvisoCostos costo={r.costo} />
      {sinFijos && (
        <Aviso tono="warn" titulo="Sin gastos fijos cargados en este periodo">
          Carga planilla, herramientas, courier propio y otros gastos en Costos › Gastos y costos.
          Sin ellos no hay punto de equilibrio que calcular.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Gastos fijos del periodo"
          value={sinFijos ? SIN_DATO : formatSoles(r.gastosFijos)}
          sub="Gasto mensual × días del periodo ÷ días del mes"
        />
        <KpiCard
          label="Margen de contribución"
          value={formatPercent(r.margenContribucion, 1)}
          sub={`Contribución ${formatSoles(r.contribucion)}: lo que queda de las ventas para pagar los fijos`}
        />
        <KpiCard
          label="Punto de equilibrio"
          value={formatSoles(pe.ventas)}
          sub={
            pe.ventas !== null
              ? `≈ ${formatNumber(pe.unidades)} unidades`
              : sinFijos
                ? "Falta cargar los gastos fijos"
                : "No se puede calcular"
          }
        />
        <KpiCard
          label="Margen de seguridad"
          value={formatPercent(margenSeguridad, 1)}
          sub={
            margenSeguridad === null
              ? "Sin punto de equilibrio"
              : margenSeguridad >= 0
                ? "Cuánto pueden caer las ventas antes de perder"
                : "Las ventas no llegan a cubrir los fijos"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[3fr_2fr]">
        <PanelCard
          titulo="Gastos fijos y costos variables"
          subtitulo="Los variables suben con cada venta; los fijos se pagan aunque no vendas"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <SubTitulo>Costos variables</SubTitulo>
              <TablaCostos
                caption="Costos variables del periodo"
                filas={variables}
                total={{
                  clave: "total",
                  etiqueta: "Total variables",
                  monto: r.costoProducto + r.merma + r.gastosVariables,
                }}
                ventas={r.ventas}
              />
              <NotaFlete nota={notaFlete(datos.flete)} />
            </div>
            <div className="min-w-0 space-y-1.5">
              <SubTitulo>Gastos fijos</SubTitulo>
              <TablaCostos
                caption="Gastos fijos del periodo"
                filas={fijos}
                total={{ clave: "total", etiqueta: "Total fijos", monto: r.gastosFijos }}
                ventas={r.ventas}
              />
            </div>
          </div>
          {r.costo.sinCostoPedidos > 0 && (
            <p className="mt-2 text-[11px] text-pc-warn">
              El costo de producto solo suma las ventas que lo tienen cargado: los variables reales
              son mayores y el punto de equilibrio también.
            </p>
          )}
        </PanelCard>

        <PanelCard
          titulo="Avance hacia el punto de equilibrio"
          subtitulo="Ventas y unidades del periodo contra las necesarias para cubrir los fijos"
        >
          {sinFijos ? (
            <p className="text-xs text-pc-text-muted">Carga tus gastos fijos para ver el avance.</p>
          ) : pe.ventas === null ? (
            <p className="text-xs text-pc-text-muted">{motivoSinPe}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <dl className="grid grid-cols-2 gap-3">
                  <Dato label="Vendido" valor={formatSoles(r.ventas)} />
                  <Dato label="Necesario" valor={formatSoles(pe.ventas)} />
                </dl>
                <ProgressBar
                  logrado={r.ventas}
                  meta={pe.ventas}
                  etiqueta="Ventas sobre el punto de equilibrio"
                />
              </div>
              <div>
                <dl className="grid grid-cols-2 gap-3">
                  <Dato label="Unidades vendidas" valor={formatNumber(r.unidades)} />
                  <Dato label="Unidades necesarias" valor={formatNumber(pe.unidades)} />
                </dl>
                {pe.unidades !== null && (
                  <ProgressBar
                    logrado={r.unidades}
                    meta={pe.unidades}
                    etiqueta="Unidades sobre el punto de equilibrio"
                  />
                )}
              </div>
              <p className="text-xs text-pc-text">
                {pe.avance !== null && pe.avance >= 1 ? (
                  <>
                    <span className="font-semibold text-pc-ok">Superado</span>: las ventas cubren{" "}
                    {formatVeces(pe.avance)} el punto de equilibrio.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-pc-warn">Por debajo</span>: faltan{" "}
                    {formatSoles(pe.ventas - r.ventas)} de ventas para cubrir los gastos fijos.
                  </>
                )}
              </p>
              <p className="text-[11px] text-pc-text-muted">
                Unidades = cantidades de producto vendidas (sin servicios), no pedidos.
              </p>
            </div>
          )}
        </PanelCard>
      </div>

      <Simulador key={`${fromDate}_${toDate}`} r={r} />
    </div>
  );
}
