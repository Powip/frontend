"use client";

/**
 * Margen por producto (FEAT-34 C5, M10).
 *
 * - Sale de las líneas de las ventas del periodo (`soloVentas`), sin servicios, agrupadas por SKU.
 * - Precio promedio cobrado = Σ subtotal ÷ unidades. El subtotal de la línea ya incluye IGV (el 99,97 % de los pedidos
 *   es `taxMode = INCLUIDO`): ya no se le suma otro 18 %.
 * - Costo = `unitCost` de la línea (el costo al vender, pisado con el real al despachar). Antes se pedía el
 *   `priceBase` actual de cada variante al catálogo y se corregía a mano en el navegador. Igual que en
 *   `_lib/ventas.ts`, un costo vacío o en 0 cuenta como «sin costo»: la fila no inventa margen y se avisa.
 * - Las ventas de productos suman las líneas: no incluyen el envío ni los descuentos del pedido entero, así que no
 *   coinciden al sol con las Ventas del Resumen.
 */

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
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
import { type LineaPedido, num, type PedidoAdmin, soloVentas } from "../_lib/ventas";

type Linea = LineaPedido & { attributes?: Record<string, unknown> | null };

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
  costo: { cobertura: number | null; sinCostoPedidos: number; sinCostoMonto: number };
  skuSinCosto: number;
  skuParciales: number;
}

const varianteDe = (linea: Linea) =>
  linea.attributes && typeof linea.attributes === "object"
    ? Object.values(linea.attributes)
        .filter((v) => typeof v === "string" && v.trim() !== "")
        .join(" · ")
    : "";

/** Margen por SKU de las líneas de las ventas (pedidos entregados) del periodo. */
function calcularMargen(pedidos: PedidoAdmin[]): MargenPeriodo {
  const grupos = new Map<
    string,
    Omit<FilaProducto, "precioPromedio" | "costoUnitario" | "margen" | "margenPct" | "estadoCosto">
  >();
  const pedidosSinCosto = new Set<string>();
  let sinCostoMonto = 0;

  soloVentas(pedidos).forEach((pedido, indice) => {
    for (const linea of (pedido.items ?? []) as Linea[]) {
      if (linea.lineKind === "SERVICE") continue;
      const cantidad = num(linea.quantity);
      if (cantidad <= 0) continue;
      const sku = (linea.sku ?? "").trim();
      const clave = sku || linea.productVariantId || (linea.productName ?? "").trim() || "sin-sku";
      const fila = grupos.get(clave) ?? {
        clave,
        sku,
        producto: (linea.productName ?? "").trim() || "Producto sin nombre",
        variante: varianteDe(linea),
        unidades: 0,
        ventas: 0,
        unidadesConCosto: 0,
        ventasConCosto: 0,
        costoTotal: 0,
      };
      const subtotal = num(linea.subtotal);
      const costo = num(linea.unitCost);
      fila.unidades += cantidad;
      fila.ventas += subtotal;
      if (costo > 0) {
        fila.unidadesConCosto += cantidad;
        fila.ventasConCosto += subtotal;
        fila.costoTotal += costo * cantidad;
      } else {
        pedidosSinCosto.add(pedido.id ?? `pedido-${indice}`);
        sinCostoMonto += subtotal;
      }
      grupos.set(clave, fila);
    }
  });

  const filas: FilaProducto[] = [...grupos.values()]
    .map((g) => {
      const estadoCosto: EstadoCosto =
        g.unidadesConCosto === 0 ? "sin_costo" : g.unidadesConCosto < g.unidades ? "parcial" : "completo";
      const margen = estadoCosto === "sin_costo" ? null : g.ventasConCosto - g.costoTotal;
      return {
        ...g,
        precioPromedio: g.unidades > 0 ? g.ventas / g.unidades : null,
        costoUnitario: g.unidadesConCosto > 0 ? g.costoTotal / g.unidadesConCosto : null,
        margen,
        margenPct: margen !== null && g.ventasConCosto !== 0 ? margen / g.ventasConCosto : null,
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
    costo: {
      cobertura: ventas > 0 ? (ventas - sinCostoMonto) / ventas : null,
      sinCostoPedidos: pedidosSinCosto.size,
      sinCostoMonto,
    },
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
  const margen = useMemo(() => calcularMargen(datos.pedidos), [datos.pedidos]);
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
          value={formatPercent(margen.costo.cobertura)}
          sub={`${formatNumber(margen.skuSinCosto)} SKU sin costo · ${formatNumber(margen.skuParciales)} con costo parcial`}
        />
      </div>

      <AvisoCostos costo={margen.costo} />
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
