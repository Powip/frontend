"use client";

/**
 * Margen por producto (FEAT-34 C5, M10).
 *
 * - Sale de las líneas de las ventas del periodo (por fecha de entrega), agrupadas por SKU en ms-ventas
 *   (`porProducto`), sin servicios.
 * - Precio promedio cobrado = Σ subtotal ÷ unidades. El subtotal de la línea ya incluye IGV (el 99,97 % de los pedidos
 *   es `taxMode = INCLUIDO`): ya no se le suma otro 18 %.
 * - Costo = `unitCost` de la línea (el costo al vender, pisado con el real al despachar). Antes se pedía el
 *   `priceBase` actual de cada variante al catálogo y se corregía a mano en el navegador. Un costo vacío o en 0 cuenta
 *   como «sin costo»: la fila no inventa margen y se avisa.
 * - El aviso de costos usa los totales del periodo (los mismos de Resumen): una venta con alguna línea sin costo
 *   cuenta entera como «sin costo».
 * - Las ventas de productos suman las líneas: no incluyen el envío ni los descuentos del pedido entero, así que no
 *   coinciden al sol con las Ventas del Resumen.
 */

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import type { ProductoVendido } from "@/interfaces/IAdministracion";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  Aviso,
  AvisoCostos,
  type ColumnaTabla,
  claseInput,
  formatNumber,
  formatPercent,
  formatSoles,
  formatSolesDecimales,
  KpiCard,
  PanelCard,
  PanelError,
  PanelSkeleton,
  SIN_DATO,
} from "../_components/ui";
import { useResultadosPeriodo } from "../_lib/useResultados";

type EstadoCosto = "completo" | "parcial" | "sin_costo";

interface FilaProducto {
  clave: string;
  sku: string;
  producto: string;
  variante: string;
  unidades: number;
  ventas: number;
  precioPromedio: number | null;
  unidadesConCosto: number;
  /** Ventas de las unidades que tienen costo (base del margen). */
  ventasConCosto: number;
  costoTotal: number;
  costoUnitario: number | null;
  margen: number | null;
  margenPct: number | null;
  estadoCosto: EstadoCosto;
}

interface MargenPeriodo {
  filas: FilaProducto[];
  unidades: number;
  ventas: number;
  ventasConCosto: number;
  costoTotal: number;
  margen: number;
  margenPct: number | null;
  /** Parte de lo vendido en productos (Σ subtotal) que tiene costo. */
  coberturaLineas: number | null;
  skuSinCosto: number;
  skuParciales: number;
}

/** Margen por SKU de las líneas de las ventas (pedidos entregados) del periodo. */
function calcularMargen(productos: readonly ProductoVendido[]): MargenPeriodo {
  const filas: FilaProducto[] = productos
    .filter((p) => p.unidades > 0)
    .map((p) => {
      const estadoCosto: EstadoCosto =
        p.unidadesConCosto === 0 ? "sin_costo" : p.unidadesConCosto < p.unidades ? "parcial" : "completo";
      const margen = estadoCosto === "sin_costo" ? null : p.ventasConCosto - p.costo;
      return {
        clave: p.clave,
        sku: p.sku,
        producto: p.producto,
        variante: p.variante,
        unidades: p.unidades,
        ventas: p.ventas,
        precioPromedio: p.ventas / p.unidades,
        unidadesConCosto: p.unidadesConCosto,
        ventasConCosto: p.ventasConCosto,
        costoTotal: p.costo,
        costoUnitario: p.unidadesConCosto > 0 ? p.costo / p.unidadesConCosto : null,
        margen,
        margenPct: margen !== null && p.ventasConCosto !== 0 ? margen / p.ventasConCosto : null,
        estadoCosto,
      };
    })
    .sort((a, b) => b.ventas - a.ventas || a.producto.localeCompare(b.producto));

  const ventas = filas.reduce((s, f) => s + f.ventas, 0);
  const ventasConCosto = filas.reduce((s, f) => s + f.ventasConCosto, 0);
  const costoTotal = filas.reduce((s, f) => s + f.costoTotal, 0);
  const margen = ventasConCosto - costoTotal;
  return {
    filas,
    unidades: filas.reduce((s, f) => s + f.unidades, 0),
    ventas,
    ventasConCosto,
    costoTotal,
    margen,
    margenPct: ventasConCosto !== 0 ? margen / ventasConCosto : null,
    coberturaLineas: ventas > 0 ? ventasConCosto / ventas : null,
    skuSinCosto: filas.filter((f) => f.estadoCosto === "sin_costo").length,
    skuParciales: filas.filter((f) => f.estadoCosto === "parcial").length,
  };
}

const COLUMNAS: ColumnaTabla<FilaProducto>[] = [
  {
    id: "producto",
    header: "Producto",
    align: "left",
    className: "max-w-[16rem] sm:max-w-[22rem]",
    cell: (f) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium" title={f.producto}>
          {f.producto}
        </span>
        {f.variante && <span className="block truncate text-[11px] text-pc-text-muted">{f.variante}</span>}
      </span>
    ),
    sortValue: (f) => f.producto,
  },
  {
    id: "sku",
    header: "SKU",
    align: "left",
    cell: (f) => <span className="text-pc-text-muted">{f.sku || SIN_DATO}</span>,
    sortValue: (f) => f.sku,
  },
  { id: "unidades", header: "Unidades", cell: (f) => formatNumber(f.unidades), sortValue: (f) => f.unidades },
  { id: "ventas", header: "Ventas", cell: (f) => formatSoles(f.ventas), sortValue: (f) => f.ventas },
  {
    id: "precio",
    header: "Precio prom.",
    cell: (f) => formatSolesDecimales(f.precioPromedio),
    sortValue: (f) => f.precioPromedio,
  },
  {
    id: "costo",
    header: "Costo unit.",
    cell: (f) =>
      f.estadoCosto === "sin_costo" ? (
        <span className="text-pc-text-muted">Sin costo</span>
      ) : (
        <span title={f.estadoCosto === "parcial" ? `${f.unidadesConCosto} de ${f.unidades} unidades con costo` : undefined}>
          {formatSolesDecimales(f.costoUnitario)}
          {f.estadoCosto === "parcial" && (
            <small className="ml-1 font-semibold text-pc-warn">
              {f.unidadesConCosto}/{f.unidades} uds
            </small>
          )}
        </span>
      ),
    sortValue: (f) => f.costoUnitario,
  },
  {
    id: "margen",
    header: "Margen S/",
    cell: (f) => (
      <span className={cn("font-semibold", f.margen !== null && f.margen < 0 && "text-pc-bad")}>
        {f.margen === null ? SIN_DATO : formatSoles(f.margen)}
      </span>
    ),
    sortValue: (f) => f.margen,
  },
  {
    id: "margenPct",
    header: "Margen %",
    cell: (f) => (
      <span className={cn(f.margenPct !== null && f.margenPct < 0 && "text-pc-bad")}>
        {formatPercent(f.margenPct, 1)}
      </span>
    ),
    sortValue: (f) => f.margenPct,
  },
];

export default function MargenProductoPage() {
  const { fromDate, toDate } = useAdminPeriod();
  const datos = useResultadosPeriodo(fromDate, toDate);
  const margen = useMemo(() => calcularMargen(datos.servidor.porProducto), [datos.servidor.porProducto]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaId = useId();

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return margen.filas;
    return margen.filas.filter((f) =>
      [f.producto, f.sku, f.variante].some((campo) => campo.toLowerCase().includes(texto)),
    );
  }, [margen.filas, busqueda]);

  if (datos.cargando) {
    return (
      <div className="space-y-3.5">
        <PanelSkeleton variant="kpis" label="margen por producto" />
        <PanelSkeleton variant="tabla" label="tabla de productos" />
      </div>
    );
  }
  if (datos.error) {
    return <PanelError error={datos.error instanceof Error ? datos.error : new Error("Error desconocido")} />;
  }

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Ventas de productos"
          value={formatSoles(margen.ventas)}
          sub="Suma de las líneas, con IGV (sin envío ni descuentos del pedido)"
        />
        <KpiCard
          label="Unidades vendidas"
          value={formatNumber(margen.unidades)}
          sub={`${formatNumber(margen.filas.length)} ${margen.filas.length === 1 ? "producto" : "productos"} (SKU)`}
        />
        <KpiCard
          label="Margen bruto"
          value={margen.ventasConCosto > 0 ? formatSoles(margen.margen) : SIN_DATO}
          sub={
            margen.ventasConCosto > 0
              ? `${formatPercent(margen.margenPct, 1)} de lo vendido con costo`
              : "Ninguna venta tiene costo cargado"
          }
        />
        <KpiCard
          label="Ventas con costo"
          value={formatPercent(margen.coberturaLineas)}
          sub={`De lo vendido en productos · ${formatNumber(margen.skuSinCosto)} SKU sin costo · ${formatNumber(margen.skuParciales)} con costo parcial`}
        />
      </div>

      <AvisoCostos costo={datos.resultados.costo} />
      {margen.skuSinCosto > 0 && (
        <Aviso tono="info">
          Las filas «Sin costo» no muestran margen y no suman al margen bruto. Las que tienen costo solo en parte (por
          ejemplo «3/5 uds») calculan el margen con las unidades que sí lo tienen.
        </Aviso>
      )}

      <PanelCard
        titulo="Margen por SKU"
        subtitulo="Precio promedio cobrado (con IGV) y costo al vender de cada producto. Margen = ventas − costo de las unidades vendidas"
        acciones={
          <div className="relative">
            <label htmlFor={busquedaId} className="sr-only">
              Buscar producto o SKU
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-pc-text-muted"
            />
            <input
              id={busquedaId}
              type="search"
              placeholder="Buscar producto o SKU"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className={cn(claseInput, "w-56 max-w-full pl-7")}
            />
          </div>
        }
      >
        <AdminTable
          caption="Unidades, ventas, precio promedio, costo y margen por SKU"
          columns={COLUMNAS}
          rows={filas}
          getRowKey={(f) => f.clave}
          maxHeight={560}
          emptyMessage={
            margen.filas.length === 0 ? "No hay productos vendidos en este periodo" : "Ningún producto coincide con la búsqueda"
          }
          footer={
            busqueda.trim()
              ? undefined
              : {
                  producto: "Total",
                  unidades: formatNumber(margen.unidades),
                  ventas: formatSoles(margen.ventas),
                  precio: formatSolesDecimales(margen.unidades > 0 ? margen.ventas / margen.unidades : null),
                  margen: margen.ventasConCosto > 0 ? formatSoles(margen.margen) : SIN_DATO,
                  margenPct: formatPercent(margen.margenPct, 1),
                }
          }
        />
      </PanelCard>
    </div>
  );
}
