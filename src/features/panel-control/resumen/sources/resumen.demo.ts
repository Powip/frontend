import { UMBRAL_CRITICO_DIAS } from "../../operaciones/utils/clasificar-stock";
import { METAS_ESPECIFICACION } from "../../shared/config/panel-goals.defaults";
import {
  cumpleAccion,
  diasDelRango,
  esClienteNuevo,
  instanteAnterior,
  inventarioDemo,
  mapaProductos,
  type PedidoConEstado,
  pedidosActuales,
  pedidosEnRango,
  productosAgotados,
  repartirPauta,
  seleccionarGrupo,
  totalPauta,
} from "../../shared/data/demo/demo-consultas";
import {
  comisionPedido,
  costoPedido,
  OPERATIVOS_EN_CURSO,
  obtenerUniversoDemo,
  type UniversoDemo,
} from "../../shared/data/demo/demo-universe";
import type { PanelSource } from "../../shared/data/panel-source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { addDays } from "../../shared/utils/lima-time";
import type { AccionHoy, ResumenPanel, VentaDiaria, VentaPorCanal } from "../models/resumen.model";
import { grupos } from "../resumen-grupos";

const retorno = (facturacion: number, inversion: number) =>
  inversion > 0 ? Math.round((facturacion / inversion) * 10) / 10 : null;

const sumar = (items: PedidoConEstado[], valor: (item: PedidoConEstado) => number) =>
  items.reduce((total, item) => total + valor(item), 0);

function facturacionPorDia(
  items: PedidoConEstado[],
): Map<string, { facturacion: number; ventas: number }> {
  const porDia = new Map<string, { facturacion: number; ventas: number }>();
  for (const { pedido, estado } of items) {
    if (!estado.venta) continue;
    const actual = porDia.get(pedido.dia) ?? { facturacion: 0, ventas: 0 };
    porDia.set(pedido.dia, {
      facturacion: actual.facturacion + pedido.neto,
      ventas: actual.ventas + 1,
    });
  }
  return porDia;
}

function accionesDemo(universo: UniversoDemo, query: PanelQuery, now: number): AccionHoy[] {
  const actuales = pedidosActuales(universo, query, now);
  const agotados = productosAgotados(universo, query);
  const acciones: AccionHoy[] = [];

  const agregar = (
    id: AccionHoy["id"],
    urgencia: AccionHoy["urgencia"],
    items: PedidoConEstado[],
    extra: Partial<AccionHoy> & Pick<AccionHoy, "accion" | "pestana" | "grupo">,
  ) => {
    if (!items.length) return;
    acciones.push({
      clave: extra.courier ? `${id}:${extra.courier}` : id,
      id,
      urgencia,
      pedidos: items.length,
      monto: sumar(items, ({ pedido }) => pedido.neto),
      courier: null,
      plazoDias: null,
      productos: [],
      ...extra,
    });
  };

  agregar(
    "leads_sin_llamar",
    "alta",
    actuales.filter((item) => cumpleAccion("leads_sin_llamar", item, now, agotados)),
    {
      accion: "llamar",
      pestana: "callcenter",
      grupo: grupos.accion("leads_sin_llamar", "Leads sin llamar", "llamar"),
    },
  );
  agregar(
    "ventas_sin_guia",
    "alta",
    actuales.filter((item) => cumpleAccion("ventas_sin_guia", item, now, agotados)),
    {
      accion: "asignar_guia",
      pestana: "operaciones",
      grupo: grupos.accion("ventas_sin_guia", "Ventas sin guía +24 h", "asignar_guia"),
    },
  );

  const vencidos = actuales.filter((item) =>
    cumpleAccion("courier_no_liquida", item, now, agotados),
  );
  const porCourier = new Map<string, PedidoConEstado[]>();
  for (const item of vencidos) {
    const courier = item.pedido.courier ?? "Sin courier";
    porCourier.set(courier, [...(porCourier.get(courier) ?? []), item]);
  }
  const topCouriers = [...porCourier.entries()]
    .sort(
      (a, b) => sumar(b[1], ({ pedido }) => pedido.neto) - sumar(a[1], ({ pedido }) => pedido.neto),
    )
    .slice(0, 2);
  for (const [courier, items] of topCouriers) {
    agregar("courier_no_liquida", "alta", items, {
      courier,
      plazoDias: items[0].pedido.plazoLiquidacionDias,
      accion: "pedir_liquidacion",
      pestana: "finanzas",
      grupo: grupos.accion("courier_no_liquida", `${courier} no liquida`, "pedir_liquidacion", {
        courier,
      }),
    });
  }

  const conAgotados = actuales.filter((item) =>
    cumpleAccion("productos_agotados", item, now, agotados),
  );
  agregar("productos_agotados", "media", conAgotados, {
    productos: [
      ...new Set(
        conAgotados.flatMap(({ pedido }) =>
          pedido.items.map((linea) => linea.productoId).filter((id) => agotados.has(id)),
        ),
      ),
    ]
      .map((id) => universo.productos.find((producto) => producto.id === id)?.nombre ?? id)
      .sort(),
    accion: "avisar_cliente",
    pestana: "operaciones",
    grupo: grupos.accion("productos_agotados", "Ventas con productos agotados", "avisar_cliente"),
  });
  agregar(
    "envios_retrasados",
    "media",
    actuales.filter((item) => cumpleAccion("envios_retrasados", item, now, agotados)),
    {
      accion: "reclamar_courier",
      pestana: "operaciones",
      grupo: grupos.accion("envios_retrasados", "Envíos retrasados", "reclamar_courier"),
    },
  );
  agregar(
    "anulaciones_sin_motivo",
    "baja",
    seleccionarGrupo(universo, query, "anulaciones_sin_motivo", {}, now),
    {
      accion: "completar_motivo",
      pestana: "callcenter",
      grupo: grupos.accion("anulaciones_sin_motivo", "Anulaciones sin motivo", "completar_motivo"),
    },
  );

  return acciones;
}

function construirResumen(
  universo: UniversoDemo,
  query: PanelQuery,
  items: PedidoConEstado[],
  desde: string,
  hasta: string,
  verCostos: boolean,
  now: number,
  anteriorPorDia: Map<string, { facturacion: number; ventas: number }> | null,
  incluirHoy: boolean,
): ResumenPanel {
  const ventas = items.filter(({ estado }) => estado.venta);
  const productos = mapaProductos(universo);
  const reparto = repartirPauta(universo, query, desde, hasta, items);
  const leads = items.filter(({ pedido }) => pedido.entrada === "lead");
  const confirmados = leads.filter(({ estado }) => estado.venta);
  const anulados = leads.filter(({ estado }) => estado.estado === "ANULADO");
  const abiertos = leads.filter(({ estado }) => estado.leadAbierto);
  const facturacion = sumar(ventas, ({ pedido }) => pedido.neto);
  const enCurso = ventas.filter(
    ({ estado }) => estado.operativo !== null && OPERATIVOS_EN_CURSO.includes(estado.operativo),
  );
  const entregados = ventas.filter(({ estado }) => estado.operativo === "entregado");
  const rechazados = ventas.filter(({ estado }) => estado.operativo === "rechazado");
  const porLiquidar = ventas.filter(({ estado }) => estado.cobro === "por_liquidar");
  const vencidos = porLiquidar.filter(({ estado }) => estado.vencido);
  const cobrados = ventas.filter(({ estado }) => estado.cobro === "pagado");
  const enCursoPorCobrar = ventas.filter(({ estado }) => estado.cobro === "en_curso");
  const efectividad =
    entregados.length + rechazados.length > 0
      ? entregados.length / (entregados.length + rechazados.length)
      : null;
  const confirmacion =
    confirmados.length + anulados.length > 0
      ? confirmados.length / (confirmados.length + anulados.length)
      : null;

  const porDia = facturacionPorDia(items);
  const ventasDiarias: VentaDiaria[] = diasDelRango(desde, hasta).map((dia, index) => {
    const actual = porDia.get(dia) ?? { facturacion: 0, ventas: 0 };
    const diaAnterior = anteriorPorDia ? addDays(query.anterior_desde, index) : null;
    const valido = diaAnterior !== null && diaAnterior <= query.anterior_hasta;
    return {
      dia,
      facturacion: actual.facturacion,
      ventas: actual.ventas,
      diaAnterior: valido ? diaAnterior : null,
      facturacionAnterior:
        valido && anteriorPorDia ? (anteriorPorDia.get(diaAnterior)?.facturacion ?? 0) : null,
    };
  });

  const porCanal = new Map<string, VentaPorCanal>();
  for (const { pedido } of ventas) {
    const clave = pedido.canalId ?? "";
    const fila = porCanal.get(clave) ?? {
      canalId: pedido.canalId,
      canalNombre: pedido.canalNombre,
      color: null,
      facturacion: 0,
      ventas: 0,
    };
    fila.facturacion += pedido.neto;
    fila.ventas += 1;
    porCanal.set(clave, fila);
  }
  const ventasPorCanal = [...porCanal.values()]
    .map((fila) =>
      verCostos && fila.canalId !== null
        ? {
            ...fila,
            retornoPublicidad: retorno(
              fila.facturacion,
              reparto.porCanal.get(fila.canalId)?.total ?? 0,
            ),
          }
        : fila,
    )
    .sort((a, b) =>
      a.canalId === null ? 1 : b.canalId === null ? -1 : b.facturacion - a.facturacion,
    );

  const clientes = new Set(ventas.map(({ pedido }) => pedido.clienteId));
  const historial = new Map<string, number>();
  for (const pedido of universo.pedidos) {
    if (pedido.tConf === null || pedido.ts > now) continue;
    historial.set(pedido.clienteId, (historial.get(pedido.clienteId) ?? 0) + 1);
  }
  const nuevos = [...clientes].filter((clienteId) => {
    const muestra = ventas.find(({ pedido }) => pedido.clienteId === clienteId);
    return muestra ? esClienteNuevo(universo, muestra.pedido, desde) : false;
  });
  const recurrentes = [...clientes].filter((clienteId) => (historial.get(clienteId) ?? 0) > 1);

  const inventario = inventarioDemo(universo, query, now);
  const alertasBase = inventario.filter(
    (fila) => fila.estado === "agotado" || fila.estado === "critico",
  );
  const actuales = incluirHoy ? pedidosActuales(universo, query, now) : [];
  const alertas = alertasBase
    .map((fila) => ({
      productoId: fila.producto.id,
      nombre: fila.producto.nombre,
      estado: fila.estado as "agotado" | "critico",
      disponible: fila.disponible,
      coberturaDias: fila.coberturaDias,
      ventasEsperando: actuales.filter(
        ({ pedido, estado }) =>
          pedido.items.some((linea) => linea.productoId === fila.producto.id) &&
          (estado.estado === "LLAMADO" || estado.estado === "PREPARADO"),
      ).length,
    }))
    .sort((a, b) =>
      a.estado === b.estado
        ? (a.coberturaDias ?? 0) - (b.coberturaDias ?? 0)
        : a.estado === "agotado"
          ? -1
          : 1,
    );

  const entregadoMonto = sumar(entregados, ({ pedido }) => pedido.neto);
  const resumen: ResumenPanel = {
    vendi: {
      facturacion,
      ventas: ventas.length,
      ticket: ventas.length ? facturacion / ventas.length : null,
      leads: leads.length,
      confirmacion,
    },
    entregado: {
      entregado: entregadoMonto,
      entregas: entregados.length,
      efectividadEntrega: efectividad,
    },
    meDeben: {
      total:
        sumar(porLiquidar, ({ pedido }) => pedido.neto) +
        sumar(enCursoPorCobrar, ({ pedido }) => pedido.neto),
      porLiquidar: sumar(porLiquidar, ({ pedido }) => pedido.neto),
      enCursoPorCobrar: sumar(enCursoPorCobrar, ({ pedido }) => pedido.neto),
      vencido: sumar(vencidos, ({ pedido }) => pedido.neto),
    },
    acciones: incluirHoy ? accionesDemo(universo, query, now) : [],
    ventasDiarias,
    ventasPorCanal,
    clientes: {
      nuevos: nuevos.length,
      conCompra: clientes.size,
      recompra: clientes.size ? recurrentes.length / clientes.size : null,
      listaNegra: ventas.filter(({ pedido }) => pedido.listaNegra).length,
    },
    inventario: {
      agotados: alertas.filter((alerta) => alerta.estado === "agotado").length,
      criticos: alertas.filter((alerta) => alerta.estado === "critico").length,
      umbralCriticoDias: UMBRAL_CRITICO_DIAS,
      alertas,
    },
    flujo: {
      leads: leads.length,
      leadsAbiertos: abiertos.length,
      leadsAnulados: anulados.length,
      directasYPos: items.filter(({ pedido }) => pedido.entrada !== "lead").length,
      ventas: ventas.length,
      facturacion,
      confirmados: confirmados.length,
      confirmacion,
      enCurso: {
        pedidos: enCurso.length,
        monto: sumar(enCurso, ({ pedido }) => pedido.neto),
        porDespachar: enCurso.filter(({ estado }) => estado.operativo !== "en_envio").length,
        enEnvio: enCurso.filter(({ estado }) => estado.operativo === "en_envio").length,
      },
      entregados: { pedidos: entregados.length, monto: entregadoMonto, efectividad },
      rechazados: {
        pedidos: rechazados.length,
        perdido: sumar(rechazados, ({ pedido }) => pedido.neto),
        ...(verCostos ? { flete: sumar(rechazados, ({ estado }) => estado.flete) } : {}),
      },
      cobro: {
        cobradoTotal: sumar(cobrados, ({ pedido }) => pedido.neto),
        cobradoEntregado: sumar(
          cobrados.filter(({ estado }) => estado.operativo === "entregado"),
          ({ pedido }) => pedido.neto,
        ),
        cobradoSinEntregar: sumar(
          cobrados.filter(({ estado }) => estado.operativo !== "entregado"),
          ({ pedido }) => pedido.neto,
        ),
        porLiquidar: sumar(porLiquidar, ({ pedido }) => pedido.neto),
        vencido: sumar(vencidos, ({ pedido }) => pedido.neto),
      },
    },
  };

  if (verCostos) {
    const costos = entregados.map(({ pedido }) => costoPedido(pedido, productos));
    const costoProducto = costos.reduce((total, costo) => total + costo.costo, 0);
    const publicidad = totalPauta(reparto);
    const flete = sumar(ventas, ({ estado }) => estado.flete);
    const comisiones =
      Math.round(sumar(ventas, ({ pedido }) => comisionPedido(pedido)) * 100) / 100;
    const ganancia = entregadoMonto - costoProducto - publicidad - flete - comisiones;
    resumen.gane = {
      ganancia,
      entregado: entregadoMonto,
      margen: entregadoMonto ? ganancia / entregadoMonto : null,
      publicidad,
      costoProducto,
      flete,
      comisiones,
      entregasSinCosto: costos.filter((costo) => !costo.completo).length,
    };
  }

  return resumen;
}

export const resumenDemoSource: PanelSource<"resumen"> = {
  contractId: "resumen",
  kind: "demo",
  descripcion:
    "Datos demo deterministas: el contrato GET /panel/resumen no existe todavía. Tarjetas, gráficos y detalle salen del mismo conjunto de pedidos demo",
  fetch: async (query, context) => {
    const universo = obtenerUniversoDemo(context.catalogo, context.now);
    const verCostos = context.capabilities.has("ver_costos");
    const tAnterior = instanteAnterior(query, context.now);
    const anterioresItems = pedidosEnRango(
      universo,
      query,
      query.anterior_desde,
      query.anterior_hasta,
      tAnterior,
    );
    const actualesItems = pedidosEnRango(universo, query, query.desde, query.hasta, context.now);
    return {
      actual: construirResumen(
        universo,
        query,
        actualesItems,
        query.desde,
        query.hasta,
        verCostos,
        context.now,
        facturacionPorDia(anterioresItems),
        true,
      ),
      anterior_misma_antiguedad: construirResumen(
        universo,
        query,
        anterioresItems,
        query.anterior_desde,
        query.anterior_hasta,
        verCostos,
        tAnterior,
        null,
        false,
      ),
      metas: METAS_ESPECIFICACION,
      generado_en: new Date(context.now).toISOString(),
    };
  },
};
