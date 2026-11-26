/**
 * Fixtures de pruebas: arma la respuesta de `/administracion/resultados` a partir de pedidos de prueba, con las mismas
 * reglas que aplica ms-ventas (las de `_lib/ventas.ts`). El día de la venta es el `created_at` del pedido de prueba,
 * que acá hace de fecha de entrega. Flete conocido = `carrierShippingCost` > 0.
 *
 * Así las pruebas de las páginas siguen describiendo ventas «de verdad» (pedidos, líneas, canales) aunque las páginas
 * ya no reciban pedidos crudos.
 */

import type { IGastoOperativo } from "@/interfaces/IAdmin";
import type { Agregado, ProductoVendido, ResultadosAdministracion } from "@/interfaces/IAdministracion";
import { isCommercialSale } from "@/utils/commercialOrderReporting";
import type { PublicidadConectada } from "../publicidad";
import { calcularResultados, prorratearGastos } from "../resultados";
import { coberturaFlete, resultadosVacios, resumenDeAgregado } from "../servidor";
import type { DatosPeriodo } from "../useResultados";
import {
  costoDudosoLinea,
  costoDudosoPedido,
  costoPedido,
  diaVenta,
  type LineaPedido,
  montoVenta,
  num,
  pagadoPedido,
  type PedidoAdmin,
  soloVentas,
  unidadesPedido,
} from "../ventas";

export function agregadoDePedidos(pedidos: PedidoAdmin[]): Agregado {
  const a: Agregado = {
    pedidos: 0,
    monto: 0,
    unidades: 0,
    costo: 0,
    comisiones: 0,
    flete: { monto: 0, pedidos: 0 },
    sinCosto: { pedidos: 0, monto: 0 },
    costoDudoso: { pedidos: 0, monto: 0 },
  };
  for (const venta of soloVentas(pedidos)) {
    const total = montoVenta(venta);
    a.pedidos += 1;
    a.monto += total;
    a.unidades += unidadesPedido(venta);
    a.comisiones += num(venta.channelFee);
    const flete = num(venta.carrierShippingCost);
    if (flete > 0) {
      a.flete.monto += flete;
      a.flete.pedidos += 1;
    }
    const costo = costoPedido(venta);
    if (costo === null) {
      a.sinCosto.pedidos += 1;
      a.sinCosto.monto += total;
    } else {
      a.costo += costo;
      if (costoDudosoPedido(venta)) {
        a.costoDudoso.pedidos += 1;
        a.costoDudoso.monto += total;
      }
    }
  }
  return a;
}

type Linea = LineaPedido & { attributes?: Record<string, unknown> | null };

const varianteDe = (linea: Linea) =>
  linea.attributes && typeof linea.attributes === "object"
    ? Object.values(linea.attributes)
        .filter((v) => typeof v === "string" && v.trim() !== "")
        .join(" · ")
    : "";

function productosDe(ventas: PedidoAdmin[]): ProductoVendido[] {
  const grupos = new Map<string, ProductoVendido>();
  for (const venta of ventas) {
    for (const linea of (venta.items ?? []) as Linea[]) {
      if (linea.lineKind === "SERVICE") continue;
      const cantidad = num(linea.quantity);
      if (cantidad <= 0) continue;
      const sku = (linea.sku ?? "").trim();
      const clave = sku || linea.productVariantId || (linea.productName ?? "").trim() || "sin-sku";
      const fila = grupos.get(clave) ?? {
        clave,
        sku,
        variantId: linea.productVariantId ?? null,
        producto: (linea.productName ?? "").trim() || "Producto sin nombre",
        variante: varianteDe(linea),
        unidades: 0,
        ventas: 0,
        unidadesConCosto: 0,
        ventasConCosto: 0,
        costo: 0,
        lineasDudosas: 0,
      };
      const subtotal = num(linea.subtotal);
      const costo = num(linea.unitCost);
      fila.unidades += cantidad;
      fila.ventas += subtotal;
      if (costo > 0) {
        fila.unidadesConCosto += cantidad;
        fila.ventasConCosto += subtotal;
        fila.costo += costo * cantidad;
        if (costoDudosoLinea(linea)) fila.lineasDudosas += 1;
      }
      grupos.set(clave, fila);
    }
  }
  return [...grupos.values()].sort((a, b) => b.unidades - a.unidades);
}

const canalDe = (p: PedidoAdmin) => (p.salesChannel ?? "").trim() || null;

function agruparPor<T>(lista: T[], clave: (x: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const x of lista) grupos.set(clave(x), [...(grupos.get(clave(x)) ?? []), x]);
  return grupos;
}

/** `/administracion/resultados` de un periodo con estos pedidos (cualquier estado; solo las ventas suman). */
export function servidorDePedidos(
  pedidos: PedidoAdmin[],
  desde = "2026-11-01",
  hasta = "2026-11-30",
  extra: Partial<ResultadosAdministracion> = {},
): ResultadosAdministracion {
  const ventas = soloVentas(pedidos);
  const conDia = ventas.filter((v) => !!diaVenta(v));
  const porDia = [...agruparPor(conDia, (v) => diaVenta(v) as string).entries()]
    .map(([dia, lista]) => ({ dia, ...agregadoDePedidos(lista) }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
  const porCanal = [...agruparPor(ventas, (v) => canalDe(v) ?? "").entries()]
    .map(([canal, lista]) => ({ canal: canal || null, ...agregadoDePedidos(lista) }))
    .sort((a, b) => b.monto - a.monto);
  const porDiaCanal = [...agruparPor(conDia, (v) => `${diaVenta(v)}|${canalDe(v) ?? ""}`).entries()].map(
    ([clave, lista]) => {
      const [dia, canal] = clave.split("|");
      const a = agregadoDePedidos(lista);
      return { dia, canal: canal || null, pedidos: a.pedidos, monto: a.monto, unidades: a.unidades };
    },
  );
  const enCurso = pedidos.filter(
    (p) => isCommercialSale(p) && p.status !== "ENTREGADO" && p.status !== "ANULADO",
  );
  const conAdelanto = enCurso.filter((p) => p.status !== "INCOMPLETE" && pagadoPedido(p) > 0);
  return {
    ...resultadosVacios(desde, hasta),
    totales: agregadoDePedidos(pedidos),
    porDia,
    porCanal,
    porDiaCanal,
    porProducto: productosDe(ventas),
    enCurso: {
      pedidos: enCurso.length,
      adelantos: {
        pedidos: conAdelanto.length,
        monto: conAdelanto.reduce((s, p) => s + pagadoPedido(p), 0),
      },
    },
    ...extra,
  };
}

export const PUBLICIDAD_SIN_CUENTAS: PublicidadConectada = {
  estado: "sin_cuentas",
  monto: 0,
  porDia: new Map(),
  cobertura: null,
  diasFaltantes: 0,
  provisional: false,
  otrasMonedas: [],
};

/**
 * Lo que devuelve `useResultadosPeriodo` con estos pedidos. `envios` reemplaza el flete de los pedidos (para probar
 * la cuenta sin armar fletes pedido por pedido); `fleteConocido` dice en cuántas entregas se conoce (por defecto,
 * todas).
 */
export function datosPeriodoDe(
  desde: string,
  hasta: string,
  pedidos: PedidoAdmin[],
  opciones: {
    gastos?: IGastoOperativo[];
    merma?: number;
    envios?: number;
    fleteConocido?: number;
    publicidad?: PublicidadConectada;
    cargando?: boolean;
    error?: unknown;
    servidor?: Partial<ResultadosAdministracion>;
    igvPct?: number;
  } = {},
): DatosPeriodo {
  const servidor = servidorDePedidos(pedidos, desde, hasta, opciones.servidor);
  if (opciones.envios !== undefined) {
    servidor.totales = {
      ...servidor.totales,
      flete: { monto: opciones.envios, pedidos: opciones.fleteConocido ?? servidor.totales.pedidos },
    };
  }
  const gastosCrudos = opciones.gastos ?? [];
  const ventas = resumenDeAgregado(servidor.totales);
  const flete = coberturaFlete(servidor.totales);
  const gastos = prorratearGastos(gastosCrudos, desde, hasta);
  const publicidad = opciones.publicidad ?? PUBLICIDAD_SIN_CUENTAS;
  const merma = opciones.merma ?? 0;
  return {
    desde,
    hasta,
    cargando: opciones.cargando ?? false,
    error: opciones.error ?? null,
    servidor,
    ventas,
    gastos,
    gastosCrudos,
    merma: { unidades: 0, costo: merma },
    envios: flete.monto,
    flete,
    publicidad,
    resultados: calcularResultados({
      ventas,
      gastos,
      merma,
      envios: flete.monto,
      publicidadConectada: publicidad.monto,
      igvPct: opciones.igvPct ?? 18,
    }),
  };
}
