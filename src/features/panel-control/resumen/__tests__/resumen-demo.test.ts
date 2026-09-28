import type { DetalleGrupo, DetalleResponse } from "../../detalle/models/detalle.model";
import { detalleDemoSource } from "../../detalle/sources/detalle.demo";
import { PANEL_ROLE_POLICIES } from "../../shared/config/panel-roles.config";
import type { PanelSourceContext } from "../../shared/data/panel-source";
import type { PanelCatalogo } from "../../shared/models/panel-catalog.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import type { PanelCapability, PanelRole } from "../../shared/models/panel-role.model";
import type { AccionHoy } from "../models/resumen.model";
import { grupos } from "../resumen-grupos";
import { resumenDemoSource } from "../sources/resumen.demo";
import { cuadresResumen } from "../utils/cuadres-resumen";

const NOW = new Date("2026-09-21T21:00:00Z").getTime();

const CATALOGO: PanelCatalogo = {
  listo: true,
  tiendas: [
    { id: "t1", nombre: "Tienda 1" },
    { id: "t2", nombre: "Tienda 2" },
  ],
  canales: [
    { id: "c-lead", nombre: "Canal lead", entrada: "lead", color: null },
    { id: "c-live", nombre: "Canal live", entrada: "lead", color: null },
    { id: "c-dir", nombre: "Canal directo", entrada: "directa", color: null },
    { id: "c-pos", nombre: "Canal POS", entrada: "presencial", color: null },
    { id: "c-otro", nombre: "Canal sin entrada", entrada: null, color: null },
  ],
  asesores: [
    { id: "a1", nombre: "Asesora 1" },
    { id: "a2", nombre: "Asesora 2" },
    { id: "a3", nombre: "Asesora 3" },
  ],
};

const contexto = (role: PanelRole = "dueno"): PanelSourceContext => ({
  role,
  capabilities: new Set<PanelCapability>(PANEL_ROLE_POLICIES[role].capacidades),
  now: NOW,
  catalogo: CATALOGO,
});

const MES: PanelQuery = {
  desde: "2026-09-01",
  hasta: "2026-09-21",
  anterior_desde: "2026-08-01",
  anterior_hasta: "2026-08-21",
  zona_horaria: "America/Lima",
};

const resumen = async (query: PanelQuery = MES, role: PanelRole = "dueno") =>
  resumenDemoSource.fetch(query, contexto(role));

const detalle = async (
  grupo: DetalleGrupo,
  query: PanelQuery = MES,
  role: PanelRole = "dueno",
  extra: { pagina?: number; tamano?: number; buscar?: string } = {},
): Promise<DetalleResponse> =>
  detalleDemoSource.fetch(
    {
      ...query,
      grupo: grupo.tipo,
      grupo_params: JSON.stringify(grupo.params),
      pagina: extra.pagina ?? 1,
      tamano_pagina: extra.tamano ?? 10_000,
      ...(extra.buscar ? { buscar: extra.buscar } : {}),
    },
    contexto(role),
  );

const FILTROS: [string, Partial<PanelQuery>][] = [
  ["sin filtros", {}],
  ["tienda", { tienda: "t1" }],
  ["canal", { canal: "c-live" }],
  ["entrada lead", { entrada: "lead" }],
  ["zona provincia", { zona: "provincia" }],
  ["cobro prepago", { cobro: "pre" }],
  ["asesora", { asesor: "a2" }],
  ["sin asesora", { asesor: "sin_asesor" }],
  ["turno express", { turno: "express" }],
];

describe("Resumen demo · cuadres", () => {
  it.each(FILTROS)("cuadra canales, días, flujo y cobranza con %s", async (_nombre, filtro) => {
    const { actual } = await resumen({ ...MES, ...filtro });
    expect(cuadresResumen(actual)).toEqual({
      canales: true,
      dias: true,
      flujo: true,
      cobranza: true,
    });
  });

  it("es determinista", async () => {
    const a = await resumen();
    const b = await resumen();
    expect(a.actual).toEqual(b.actual);
  });

  it("un filtro de dimensión devuelve el subconjunto correspondiente", async () => {
    const todo = await resumen();
    const canal = await resumen({ ...MES, canal: "c-live" });
    const fila = todo.actual.ventasPorCanal.find((item) => item.canalId === "c-live");
    expect(canal.actual.vendi.facturacion).toBe(fila?.facturacion);
    expect(canal.actual.vendi.ventas).toBe(fila?.ventas);

    const t1 = await resumen({ ...MES, tienda: "t1" });
    const t2 = await resumen({ ...MES, tienda: "t2" });
    expect(t1.actual.vendi.facturacion + t2.actual.vendi.facturacion).toBe(
      todo.actual.vendi.facturacion,
    );
  });

  it("conserva «Sin canal» y lo cuenta en el total", async () => {
    const { actual } = await resumen();
    const sinCanal = actual.ventasPorCanal.find((fila) => fila.canalId === null);
    expect(sinCanal).toBeDefined();
    expect(sinCanal?.canalNombre).toBeNull();
    expect(actual.ventasPorCanal[actual.ventasPorCanal.length - 1].canalId).toBeNull();
    const detalleSinCanal = await detalle(grupos.ventasCanal(null, null));
    expect(detalleSinCanal.resumen.ventas).toBe(sinCanal?.ventas);
    expect(detalleSinCanal.pedidos.filas.every((fila) => fila.canalOrigenId === null)).toBe(true);
  });
});

describe("Resumen demo · PENDIENTE no es venta", () => {
  it("los leads abiertos no suman en facturación, ventas ni detalle de ventas", async () => {
    const { actual } = await resumen();
    const abiertos = await detalle(grupos.leadsAbiertos());
    expect(abiertos.pedidos.total).toBe(actual.flujo.leadsAbiertos);
    expect(abiertos.pedidos.filas.every((fila) => fila.estado === "PENDIENTE")).toBe(true);
    expect(abiertos.resumen.ventas).toBe(0);
    expect(abiertos.resumen.facturacion).toBe(0);

    const ventas = await detalle(grupos.ventas());
    expect(
      ventas.pedidos.filas.some((fila) => fila.estado === "PENDIENTE" || fila.estado === "ANULADO"),
    ).toBe(false);
    expect(actual.flujo.leads).toBe(
      actual.flujo.confirmados + actual.flujo.leadsAnulados + actual.flujo.leadsAbiertos,
    );
  });
});

describe("Resumen demo · tarjetas, gráficos y detalle cuadran", () => {
  it("Vendí coincide con el detalle de ventas", async () => {
    const { actual } = await resumen();
    const ventas = await detalle(grupos.ventas());
    expect(ventas.resumen.facturacion).toBe(actual.vendi.facturacion);
    expect(ventas.resumen.ventas).toBe(actual.vendi.ventas);
    expect(ventas.pedidos.total).toBe(actual.vendi.ventas);
  });

  it("cada barra diaria y cada canal coinciden con su detalle", async () => {
    const { actual } = await resumen({ ...MES, tienda: "t2" });
    const query = { ...MES, tienda: "t2" };
    for (const dia of actual.ventasDiarias.slice(0, 5)) {
      const detalleDia = await detalle(grupos.ventasDia(dia.dia), query);
      expect(detalleDia.resumen.facturacion).toBe(dia.facturacion);
      expect(detalleDia.resumen.ventas).toBe(dia.ventas);
    }
    for (const fila of actual.ventasPorCanal) {
      const detalleCanal = await detalle(grupos.ventasCanal(fila.canalId, fila.canalNombre), query);
      expect(detalleCanal.resumen.facturacion).toBe(fila.facturacion);
    }
  });

  it("cada caja del flujo abre exactamente sus pedidos", async () => {
    const { actual } = await resumen();
    const { flujo, meDeben } = actual;
    const casos: [DetalleGrupo, number][] = [
      [grupos.leads(), flujo.leads],
      [grupos.leadsAnulados(), flujo.leadsAnulados],
      [grupos.directasPos(), flujo.directasYPos],
      [grupos.enCurso(), flujo.enCurso.pedidos],
      [grupos.entregados(), flujo.entregados.pedidos],
      [grupos.rechazados(), flujo.rechazados.pedidos],
    ];
    for (const [grupo, esperado] of casos) {
      expect((await detalle(grupo)).pedidos.total).toBe(esperado);
    }
    const montos: [DetalleGrupo, number][] = [
      [grupos.cobrado(), flujo.cobro.cobradoTotal],
      [grupos.cobradoSinEntregar(), flujo.cobro.cobradoSinEntregar],
      [grupos.porLiquidar(), flujo.cobro.porLiquidar],
      [grupos.noCobrado(), meDeben.total],
      [grupos.entregados(), flujo.entregados.monto],
    ];
    for (const [grupo, esperado] of montos) {
      expect((await detalle(grupo)).resumen.facturacion).toBe(esperado);
    }
  });

  it("clientes nuevos y lista negra abren sus pedidos; los desconocidos no son cero", async () => {
    const { actual } = await resumen();
    expect(actual.clientes.nuevos).not.toBeNull();
    expect(actual.clientes.nuevos ?? 0).toBeLessThanOrEqual(actual.clientes.conCompra ?? 0);
    expect(actual.clientes.recompra).toBeGreaterThanOrEqual(0);
    expect(actual.clientes.recompra).toBeLessThanOrEqual(1);
    const listaNegra = await detalle(grupos.listaNegra());
    expect(listaNegra.resumen.ventas).toBe(actual.clientes.listaNegra);
    expect(listaNegra.pedidos.filas.every((fila) => fila.listaNegra)).toBe(true);
  });
});

describe("Resumen demo · entrega y cobro separados (prepago)", () => {
  it("un prepago cobrado y no entregado no cuenta como entregado", async () => {
    const query = { ...MES, cobro: "pre" as const };
    const { actual } = await resumen(query);
    const sinEntregar = await detalle(grupos.cobradoSinEntregar(), query);
    expect(sinEntregar.pedidos.total).toBeGreaterThan(0);
    expect(sinEntregar.pedidos.filas.every((fila) => fila.cobro === "pagado")).toBe(true);
    expect(
      sinEntregar.pedidos.filas.some(
        (fila) => fila.estado === "ENTREGADO" || fila.estado === "PAGADO",
      ),
    ).toBe(false);
    const entregados = await detalle(grupos.entregados(), query);
    const idsEntregados = new Set(entregados.pedidos.filas.map((fila) => fila.id));
    expect(sinEntregar.pedidos.filas.some((fila) => idsEntregados.has(fila.id))).toBe(false);
    expect(actual.flujo.cobro.cobradoTotal).toBe(
      actual.flujo.cobro.cobradoEntregado + actual.flujo.cobro.cobradoSinEntregar,
    );
    expect(actual.meDeben.enCursoPorCobrar).toBe(0);
  });
});

describe("Resumen demo · Qué hacer hoy (§8)", () => {
  const sinAnulaciones = (acciones: AccionHoy[]) =>
    acciones.filter((accion) => accion.id !== "anulaciones_sin_motivo");

  it("las tareas de estado actual no dependen del periodo", async () => {
    const mes = await resumen();
    const semana = await resumen({
      ...MES,
      desde: "2026-09-15",
      anterior_desde: "2026-09-08",
      anterior_hasta: "2026-09-14",
    });
    expect(sinAnulaciones(semana.actual.acciones)).toEqual(sinAnulaciones(mes.actual.acciones));
  });

  it("respetan los filtros de dimensión", async () => {
    const todas = await resumen();
    const t1 = await resumen({ ...MES, tienda: "t1" });
    const leadsTodas =
      todas.actual.acciones.find((accion) => accion.id === "ventas_sin_guia")?.pedidos ?? 0;
    const leadsT1 =
      t1.actual.acciones.find((accion) => accion.id === "ventas_sin_guia")?.pedidos ?? 0;
    expect(leadsT1).toBeLessThanOrEqual(leadsTodas);
    expect(t1.actual.acciones).not.toEqual(todas.actual.acciones);
  });

  it("cada tarea abre en el detalle la misma cantidad de pedidos que anuncia", async () => {
    const { actual } = await resumen();
    expect(actual.acciones.length).toBeGreaterThan(0);
    for (const accion of actual.acciones) {
      const grupo = await detalle(accion.grupo);
      expect(grupo.pedidos.total).toBe(accion.pedidos);
      expect(accion.grupo.alcance).toBe(
        accion.id === "anulaciones_sin_motivo" ? "periodo" : "actual",
      );
    }
  });

  it("courier sin liquidar agrupa como máximo los 2 couriers con más monto", async () => {
    const { actual } = await resumen();
    const couriers = actual.acciones.filter((accion) => accion.id === "courier_no_liquida");
    expect(couriers.length).toBeLessThanOrEqual(2);
    expect(new Set(couriers.map((accion) => accion.clave)).size).toBe(couriers.length);
  });

  it("el periodo anterior no trae tareas de hoy", async () => {
    const envelope = await resumen();
    expect(envelope.anterior_misma_antiguedad?.acciones).toEqual([]);
  });
});

describe("Resumen demo · comparación a la misma antigüedad", () => {
  it("la línea anterior usa el periodo anterior fotografiado con el mismo desfase", async () => {
    const envelope = await resumen();
    const anterior = envelope.anterior_misma_antiguedad;
    expect(anterior).not.toBeNull();
    const porDia = new Map(anterior?.ventasDiarias.map((dia) => [dia.dia, dia.facturacion]));
    for (const dia of envelope.actual.ventasDiarias) {
      if (dia.diaAnterior) expect(dia.facturacionAnterior).toBe(porDia.get(dia.diaAnterior));
    }
    expect(envelope.actual.ventasDiarias[0].diaAnterior).toBe("2026-08-01");
  });
});

describe("Resumen demo · permisos", () => {
  it("la Supervisora no recibe ganancia, retorno de publicidad ni flete", async () => {
    const { actual, anterior_misma_antiguedad } = await resumen(MES, "supervisora");
    expect(actual.gane).toBeUndefined();
    expect(anterior_misma_antiguedad?.gane).toBeUndefined();
    expect(actual.ventasPorCanal.every((fila) => fila.retornoPublicidad === undefined)).toBe(true);
    expect("flete" in actual.flujo.rechazados).toBe(false);
    const productos = await detalle(grupos.ventas(), MES, "supervisora");
    expect(productos.porProducto.every((fila) => fila.margen === undefined)).toBe(true);
  });

  it("el Dueño recibe ganancia con costos incompletos informados", async () => {
    const { actual } = await resumen();
    expect(actual.gane).toBeDefined();
    expect(actual.gane?.entregado).toBe(actual.entregado.entregado);
    expect(actual.gane?.entregasSinCosto).toBeGreaterThan(0);
    const productos = await detalle(grupos.ventas());
    expect(productos.porProducto.some((fila) => fila.margen === null)).toBe(true);
  });
});

describe("Resumen demo · inventario", () => {
  it("solo alerta agotados y críticos bajo el umbral de cobertura", async () => {
    const { actual } = await resumen();
    expect(actual.inventario.umbralCriticoDias).toBe(7);
    expect(actual.inventario.alertas.length).toBeGreaterThan(0);
    for (const alerta of actual.inventario.alertas) {
      if (alerta.estado === "critico") expect(alerta.coberturaDias ?? 0).toBeLessThan(7);
      else expect(alerta.disponible ?? 0).toBeLessThanOrEqual(0);
      const esperando = await detalle(grupos.esperaProducto(alerta.productoId, alerta.nombre));
      expect(esperando.pedidos.total).toBe(alerta.ventasEsperando);
    }
  });
});

describe("Detalle demo · paginación y búsqueda", () => {
  it("pagina sobre el total del grupo sin perder pedidos", async () => {
    const completo = await detalle(grupos.ventas());
    const primera = await detalle(grupos.ventas(), MES, "dueno", { pagina: 1, tamano: 100 });
    const segunda = await detalle(grupos.ventas(), MES, "dueno", { pagina: 2, tamano: 100 });
    expect(primera.pedidos.total).toBe(completo.pedidos.total);
    expect(primera.pedidos.filas).toHaveLength(100);
    expect(primera.resumen).toEqual(completo.resumen);
    expect(
      new Set([...primera.pedidos.filas, ...segunda.pedidos.filas].map((fila) => fila.id)).size,
    ).toBe(200);
  });

  it("busca en todo el grupo, no solo en la página", async () => {
    const completo = await detalle(grupos.ventas());
    const objetivo = completo.pedidos.filas[completo.pedidos.filas.length - 1];
    const resultado = await detalle(grupos.ventas(), MES, "dueno", {
      tamano: 100,
      buscar: objetivo.numero,
    });
    expect(resultado.pedidos.total).toBe(1);
    expect(resultado.pedidos.filas[0].id).toBe(objetivo.id);
  });
});
