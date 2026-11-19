import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { OrderHeader } from "@/interfaces/IOrder";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import { orderFinancialState } from "@/utils/orderState";

/**
 * Reporte de ventas detallado del Panel (Ventas y canales → botón «Excel»).
 * Una fila por pedido, con las 26 columnas del formato pedido por el cliente
 * (ejemplo_reporte_ventas.xlsx). Datos reales de `GET /order-header/business/list`.
 */
export const REPORTE_VENTAS_COLUMNAS = [
  "N° Pedido",
  "NRO ORDEN EXTERNA",
  "Fecha de venta",
  "Despacho",
  "Vendedora",
  "Canal de venta",
  "TIENDA",
  "MARCA",
  "Cliente",
  "Teléfono",
  "Ciudad",
  "Distrito",
  "Pedidos",
  "UND PRODUCTO",
  "Productos",
  "VENTA",
  "ADELANTO",
  "Saldo de deuda",
  "ESTADO",
  "Courier",
  "Costo de envío",
  "Número de tracking",
  "Código de envío",
  "Oficina",
  "Clave de envío",
  "Link de rastreo",
] as const;

export type ReporteVentasColumna = (typeof REPORTE_VENTAS_COLUMNAS)[number];
export type ReporteVentasFila = Record<ReporteVentasColumna, string | number>;

export interface ReporteVentasOpciones {
  /** Nombre de cada tienda por id, para la columna TIENDA. */
  tiendas?: ReadonlyMap<string, string>;
  /** Sin la capacidad `ver_costos` la columna «Costo de envío» sale con «-». */
  verCostos: boolean;
  /** Base del link de rastreo; por defecto NEXT_PUBLIC_LANDING_URL o powip.lat. */
  baseRastreo?: string;
}

const VACIO = "-";

function texto(valor: string | null | undefined): string {
  const limpio = (valor ?? "").trim();
  return limpio || VACIO;
}

/** Fecha corta d/m/aaaa en hora de Lima (la misma zona del filtro de fechas del servidor). */
function fechaLima(iso: string | null | undefined): string {
  if (!iso) return VACIO;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return VACIO;
  return fecha.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
}

function monto(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0;
}

const ORDEN_ATRIBUTOS = ["talla", "talle", "size", "color"];

/** Talla primero y color después (Postgres guarda el jsonb con las claves en orden alfabético). */
function atributosOrdenados(atributos: Record<string, string> | null | undefined): string {
  const peso = (clave: string) => {
    const i = ORDEN_ATRIBUTOS.indexOf(clave.toLowerCase());
    return i === -1 ? ORDEN_ATRIBUTOS.length : i;
  };
  return Object.entries(atributos ?? {})
    .filter(([, valor]) => Boolean(valor))
    .sort(([a], [b]) => peso(a) - peso(b))
    .map(([, valor]) => valor)
    .join(" / ");
}

/** «Nombre - Talla / Color x2; Otro x1», como en el formato del cliente. */
export function productosDelPedido(items: OrderHeader["items"] | null | undefined): string {
  if (!items?.length) return VACIO;
  return items
    .map((item) => {
      const atributos = atributosOrdenados(item.attributes);
      return `${item.productName}${atributos ? ` - ${atributos}` : ""} x${item.quantity}`;
    })
    .join("; ");
}

function marcas(items: OrderHeader["items"] | null | undefined): string {
  const nombres = new Set<string>();
  for (const item of items ?? []) {
    const marca = (item as { brandName?: string | null }).brandName?.trim();
    if (marca) nombres.add(marca);
  }
  return nombres.size ? [...nombres].join(", ") : VACIO;
}

/** Ficha de canal tal como la guarda ms-ventas (`canal_config`). */
export interface FichaCanalReporte {
  id: string;
  canalNombre: string;
}

/** Igual que `normalizar` del panel (ms-ventas `panel-classify.ts`). */
const normalizarCanal = (valor: string | null | undefined): string => (valor ?? "").trim().toLowerCase();

/** Igual que `slug` del panel: sin tildes, todo lo demás a «_». */
function slugCanal(valor: string): string {
  return normalizarCanal(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Id de canal con el que el panel cuenta el pedido (`resolverCanal` de ms-ventas): la ficha cuyo
 * nombre coincide con el canal de origen o, si no, con el canal de venta; sin ficha, `txt:<slug>`.
 * Así el filtro «Canal» del panel deja en el Excel exactamente los pedidos que muestra el panel.
 */
export function canalDelPanel(
  pedido: Pick<OrderHeader, "salesChannel" | "canalOrigen">,
  fichas: readonly FichaCanalReporte[],
): string | null {
  const porNombre = new Map(fichas.map((ficha) => [normalizarCanal(ficha.canalNombre), ficha]));
  const ficha =
    porNombre.get(normalizarCanal(pedido.canalOrigen)) ?? porNombre.get(normalizarCanal(pedido.salesChannel));
  if (ficha) return ficha.id;
  const texto = (pedido.salesChannel ?? "").trim();
  return texto ? `txt:${slugCanal(texto)}` : null;
}

export function buildReporteVentasFilas(
  pedidos: readonly OrderHeader[],
  opciones: ReporteVentasOpciones,
): ReporteVentasFila[] {
  const base = (
    opciones.baseRastreo ??
    (process.env.NEXT_PUBLIC_LANDING_URL || "https://www.powip.lat")
  ).replace(/\/+$/, "");

  return pedidos.map((pedido) => {
    const items = pedido.items ?? [];
    const { totalPaid, pendingAmount } = orderFinancialState(pedido);
    const destino = pedido.deliverySnapshot ?? null;
    const cliente = pedido.customer;
    return {
      "N° Pedido": pedido.orderNumber,
      "NRO ORDEN EXTERNA": pedido.externalOrderNumber?.trim() || "",
      "Fecha de venta": fechaLima(pedido.created_at),
      // Primera salida (DESPACHADO o EN_ENVIO) según el historial de estados, como en el panel.
      Despacho: fechaLima((pedido as { dispatchedAt?: string | null }).dispatchedAt),
      Vendedora: texto(pedido.sellerName),
      "Canal de venta": texto(pedido.salesChannel).toUpperCase(),
      TIENDA: texto(pedido.storeName ?? opciones.tiendas?.get(pedido.storeId)),
      MARCA: marcas(items),
      Cliente: texto(cliente?.fullName),
      Teléfono: texto(cliente?.phoneNumber),
      Ciudad: texto(destino?.department || cliente?.city || cliente?.province),
      Distrito: texto(destino?.district || cliente?.district),
      Pedidos: items.length,
      "UND PRODUCTO": items.reduce((suma, item) => suma + (Number(item.quantity) || 0), 0),
      Productos: productosDelPedido(items),
      VENTA: monto(pedido.grandTotal),
      ADELANTO: monto(totalPaid),
      "Saldo de deuda": Number.isFinite(pendingAmount) ? monto(pendingAmount) : VACIO,
      ESTADO: getStatusLabel(pedido.status),
      Courier: texto(pedido.courier),
      "Costo de envío": opciones.verCostos ? monto(pedido.carrierShippingCost) : VACIO,
      "Número de tracking": texto(pedido.externalTrackingNumber || pedido.guideNumber),
      "Código de envío": texto(pedido.shippingCode),
      Oficina: texto(pedido.shippingOffice || destino?.agency),
      // El servidor no entrega la clave mientras el pedido tenga saldo; solo avisa que existe.
      "Clave de envío":
        pedido.shippingKey?.trim() ||
        ((pedido as { hasShippingKey?: boolean }).hasShippingKey ? "Bloqueada" : VACIO),
      "Link de rastreo": `${base}/rastreo/${pedido.orderNumber}`,
    };
  });
}

export function nombreReporteVentas(desde: string, hasta: string): string {
  return `reporte_ventas_${desde}_${hasta}.xlsx`;
}

/** Arma el libro (hoja «Ventas») con montos numéricos en formato S/. */
export function buildReporteVentasLibro(filas: readonly ReporteVentasFila[]): XLSX.WorkBook {
  const hoja = XLSX.utils.json_to_sheet(filas as ReporteVentasFila[], {
    header: [...REPORTE_VENTAS_COLUMNAS],
  });
  const columnasMonto: ReporteVentasColumna[] = ["VENTA", "ADELANTO", "Saldo de deuda", "Costo de envío"];
  const indices = columnasMonto.map((columna) => REPORTE_VENTAS_COLUMNAS.indexOf(columna));
  for (let fila = 1; fila <= filas.length; fila += 1) {
    for (const columna of indices) {
      const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
      if (celda && celda.t === "n") celda.z = '"S/ "#,##0.00';
    }
  }
  hoja["!cols"] = REPORTE_VENTAS_COLUMNAS.map((columna) => ({
    wch: columna === "Productos" ? 60 : columna === "Link de rastreo" ? 42 : Math.max(12, columna.length + 2),
  }));
  hoja["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: REPORTE_VENTAS_COLUMNAS.length - 1 } }),
  };
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Ventas");
  return libro;
}

export function descargarReporteVentas(
  filas: readonly ReporteVentasFila[],
  desde: string,
  hasta: string,
): string {
  const buffer = XLSX.write(buildReporteVentasLibro(filas), { bookType: "xlsx", type: "array" });
  const nombre = nombreReporteVentas(desde, hasta);
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    nombre,
  );
  return nombre;
}
