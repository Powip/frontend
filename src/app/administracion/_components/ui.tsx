"use client";

/**
 * Piezas visuales compartidas de Administración, con los tokens `pc-*` del Panel de control (brandbook v1.0).
 * Las tarjetas, gráficos y estados se toman tal cual del Panel (`@/components/panel-control/*`); acá viven las que el
 * Panel no puede prestar (su `DataTable` depende del contexto del Panel) y las propias del módulo.
 */

import { AlertTriangle, Info, OctagonAlert, CheckCircle2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { PanelEmpty } from "@/components/panel-control/PanelStates";
import { formatPercent, formatSoles, SIN_DATO } from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";

export { KpiCard } from "@/components/panel-control/KpiCard";
export { PanelCard } from "@/components/panel-control/PanelCard";
export { PanelEmpty, PanelError, PanelSkeleton } from "@/components/panel-control/PanelStates";
export {
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  formatVeces,
  SIN_DATO,
} from "@/features/panel-control/shared/utils/format";

// ---- Avisos ---------------------------------------------------------------------------------

type TonoAviso = "info" | "warn" | "bad" | "ok";

const TONO_AVISO: Record<TonoAviso, { caja: string; icono: ReactNode }> = {
  info: {
    caja: "border-pc-info/30 bg-pc-info-soft text-pc-info",
    icono: <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />,
  },
  warn: {
    caja: "border-pc-warn/30 bg-pc-warn-soft text-pc-warn",
    icono: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />,
  },
  bad: {
    caja: "border-pc-bad/30 bg-pc-bad-soft text-pc-bad",
    icono: <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />,
  },
  ok: {
    caja: "border-pc-ok/30 bg-pc-ok-soft text-pc-ok",
    icono: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />,
  },
};

export function Aviso({
  tono = "info",
  titulo,
  children,
  className,
}: {
  tono?: TonoAviso;
  titulo?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { caja, icono } = TONO_AVISO[tono];
  return (
    <div
      role={tono === "bad" ? "alert" : "status"}
      className={cn("flex gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed", caja, className)}
    >
      {icono}
      <div className="min-w-0">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cn(titulo && "mt-0.5", "text-pc-text")}>{children}</div>}
      </div>
    </div>
  );
}

/**
 * Aviso de ventas sin costo cargado (FEAT-34 C1): sin costo, la utilidad y los márgenes salen más altos de lo real.
 */
export interface CostoParaAviso {
  cobertura: number | null;
  sinCostoPedidos: number;
  sinCostoMonto: number;
  dudosoPedidos?: number;
  /** Fracción de lo vendido (0..1) que está en ventas con costo dudoso. */
  dudosoParte?: number | null;
}

/**
 * Avisos de costo (obligatorio donde haya costo, margen o utilidad): ventas sin costo (utilidad sobreestimada) y
 * ventas con costo igual o mayor que el precio (casi siempre el precio de venta guardado como precio base:
 * utilidad subestimada).
 */
export function AvisoCostos({ costo, className }: { costo: CostoParaAviso; className?: string }) {
  const avisos: ReactNode[] = [];
  if (costo.sinCostoPedidos > 0 && costo.cobertura !== null) {
    const faltante = 1 - costo.cobertura;
    avisos.push(
      <Aviso
        key="sin-costo"
        tono={faltante >= 0.2 ? "bad" : "warn"}
        titulo={`${costo.sinCostoPedidos.toLocaleString("es-PE")} ${costo.sinCostoPedidos === 1 ? "venta no tiene" : "ventas no tienen"} costo cargado (${formatPercent(faltante)} de lo vendido, ${formatSoles(costo.sinCostoMonto)})`}
      >
        La utilidad y los márgenes de esta pantalla están sobreestimados. Carga el precio de compra de esos productos en
        el catálogo para que las próximas ventas lo traigan.
      </Aviso>,
    );
  }
  const dudosos = costo.dudosoPedidos ?? 0;
  if (dudosos > 0) {
    const parte = costo.dudosoParte ?? null;
    avisos.push(
      <Aviso
        key="dudoso"
        tono={parte === null || parte >= 0.2 ? "bad" : "warn"}
        titulo={`En ${dudosos.toLocaleString("es-PE")} ${dudosos === 1 ? "venta" : "ventas"} el costo cargado es igual o mayor que el precio${parte !== null ? ` (${formatPercent(parte)} de lo vendido)` : ""}`}
      >
        Casi siempre es el precio de venta guardado como «precio base» del producto (pasó con los productos traídos de
        Shopify hasta el 17 de noviembre). Con ese costo, la utilidad y los márgenes salen más bajos de lo que son.
        Corrige el precio base en Productos; las ventas ya hechas conservan el costo con el que se registraron.
      </Aviso>,
    );
  }
  if (avisos.length === 0) return null;
  return <div className={cn("space-y-2", className)}>{avisos}</div>;
}

// ---- Bloques de datos -----------------------------------------------------------------------

/** Dato chico dentro de una tarjeta: etiqueta arriba, valor grande abajo. */
export function Dato({
  label,
  valor,
  sub,
  tono,
  className,
}: {
  label: ReactNode;
  valor: ReactNode;
  sub?: ReactNode;
  tono?: "ok" | "bad" | "warn";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pc-text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-lg font-bold tabular-nums text-pc-text",
          tono === "ok" && "text-pc-ok",
          tono === "bad" && "text-pc-bad",
          tono === "warn" && "text-pc-warn",
        )}
      >
        {valor}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-pc-text-muted">{sub}</dd>}
    </div>
  );
}

/** Título de un grupo dentro de la vista. */
export function SubTitulo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-bold uppercase tracking-[0.12em] text-pc-text-muted", className)}>
      {children}
    </h3>
  );
}

/** Botón de acción con el estilo del Panel. */
export const claseBotonPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-pc-primary px-3 py-1.5 text-xs font-semibold text-pc-on-fill outline-none hover:bg-pc-primary-strong focus-visible:ring-2 focus-visible:ring-pc-primary disabled:opacity-60";
export const claseBotonSecundario =
  "inline-flex items-center gap-1.5 rounded-lg border border-pc-border bg-pc-card px-3 py-1.5 text-xs font-semibold text-pc-text outline-none hover:border-pc-primary hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary disabled:opacity-60";
export const claseInput =
  "h-8 rounded-lg border border-pc-border bg-pc-card px-2.5 text-xs text-pc-text outline-none focus-visible:ring-2 focus-visible:ring-pc-primary dark:[color-scheme:dark]";

// ---- Estado de resultados -------------------------------------------------------------------

export interface LineaCascada {
  clave: string;
  etiqueta: string;
  monto: number | null;
  signo: "+" | "−" | "=";
  nota?: ReactNode;
  /** «aviso» (ámbar, por defecto) para lo que falta; «info» (gris) para notas que solo explican. */
  notaTono?: "aviso" | "info";
  total?: boolean;
  /** Línea informativa (no suma): se muestra en gris. */
  informativa?: boolean;
}

/** Tabla «concepto · S/ · % de las ventas», igual a la del Panel › Finanzas › Resultado. */
export function TablaCascada({
  lineas,
  base,
  caption,
  baseLabel = "% de las ventas",
}: {
  lineas: LineaCascada[];
  base: number;
  caption: string;
  baseLabel?: string;
}) {
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
            {baseLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((linea) => (
          <tr
            key={linea.clave}
            className={cn(
              "border-t border-pc-border-soft align-top",
              linea.total && "bg-pc-surface-muted font-bold",
              linea.informativa && "text-pc-text-muted",
            )}
          >
            <th scope="row" className="py-2 pl-1 text-left font-medium">
              <span className={cn(linea.informativa ? "text-pc-text-muted" : "text-pc-text")}>
                {linea.signo !== "=" && (
                  <span aria-hidden className="mr-1 text-pc-text-soft">
                    {linea.signo}
                  </span>
                )}
                {linea.etiqueta}
              </span>
              {linea.nota && (
                <span
                  className={cn(
                    "block text-[11px] font-normal",
                    linea.notaTono === "info" ? "text-pc-text-muted" : "text-pc-warn",
                  )}
                >
                  {linea.nota}
                </span>
              )}
            </th>
            <td
              className={cn(
                "py-2 text-right tabular-nums",
                linea.total && linea.monto !== null && linea.monto < 0 && "text-pc-bad",
              )}
            >
              {linea.monto === null ? <span className="text-pc-text-muted">{SIN_DATO}</span> : formatSoles(linea.monto)}
            </td>
            <td className="py-2 pr-1 text-right tabular-nums text-pc-text-muted">
              {linea.monto === null || !base ? SIN_DATO : formatPercent(linea.monto / base, 1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- Tabla ----------------------------------------------------------------------------------

export interface ColumnaTabla<T> {
  id: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  cell: (fila: T) => ReactNode;
  sortValue?: (fila: T) => number | string | null;
  className?: string;
}

/**
 * Tabla con el aspecto de la `DataTable` del Panel (encabezado fijo, primera columna fija, orden por columna) pero sin
 * su contexto, para usarla fuera del Panel.
 */
export function AdminTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  footer,
  emptyMessage,
  maxHeight,
  ordenable = true,
  rowClassName,
}: {
  caption: string;
  columns: ColumnaTabla<T>[];
  rows: T[];
  getRowKey: (fila: T) => string;
  footer?: Partial<Record<string, ReactNode>>;
  emptyMessage?: string;
  maxHeight?: number;
  ordenable?: boolean;
  rowClassName?: (fila: T) => string | undefined;
}) {
  const [orden, setOrden] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const filas = useMemo(() => {
    if (!orden) return rows;
    const columna = columns.find((c) => c.id === orden.id);
    if (!columna?.sortValue) return rows;
    const valor = columna.sortValue;
    return [...rows].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return orden.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, orden]);

  const alternar = (id: string) =>
    setOrden((actual) =>
      actual?.id === id ? (actual.dir === "desc" ? { id, dir: "asc" } : null) : { id, dir: "desc" },
    );

  const alinear = (align?: "left" | "right" | "center") =>
    align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";

  if (rows.length === 0) return <PanelEmpty mensaje={emptyMessage} />;

  return (
    <div
      className="min-w-0 overflow-auto rounded-xl border border-pc-border-soft"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((columna, index) => {
              const activa = orden?.id === columna.id;
              const puede = ordenable && !!columna.sortValue && rows.length > 1;
              return (
                <th
                  key={columna.id}
                  scope="col"
                  aria-sort={puede ? (activa ? (orden?.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                  className={cn(
                    "sticky top-0 z-[1] whitespace-nowrap border-b border-pc-border bg-pc-surface-muted px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-pc-text-muted",
                    alinear(columna.align),
                    index === 0 && "left-0 z-[3] sm:sticky",
                  )}
                >
                  {puede ? (
                    <button
                      type="button"
                      onClick={() => alternar(columna.id)}
                      className="inline-flex items-center gap-1 rounded uppercase outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary"
                    >
                      {columna.header}
                      <span aria-hidden className="text-pc-primary">
                        {activa ? (orden?.dir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  ) : (
                    columna.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={getRowKey(fila)} className={cn("hover:bg-pc-surface-muted/60", rowClassName?.(fila))}>
              {columns.map((columna, index) => (
                <td
                  key={columna.id}
                  className={cn(
                    "whitespace-nowrap border-b border-pc-border-soft px-2.5 py-2 tabular-nums text-pc-text",
                    alinear(columna.align),
                    index === 0 && "left-0 z-[1] bg-pc-card sm:sticky",
                    columna.className,
                  )}
                >
                  {columna.cell(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {columns.map((columna, index) => (
                <td
                  key={columna.id}
                  className={cn(
                    "whitespace-nowrap border-t border-pc-border bg-pc-surface-muted px-2.5 py-2 font-bold tabular-nums text-pc-text",
                    alinear(columna.align),
                    index === 0 && "left-0 sm:sticky",
                  )}
                >
                  {footer[columna.id] ?? ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
