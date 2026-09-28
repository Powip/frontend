import { clientesZonasDemoSource } from "../../clientes-zonas/sources/clientes-zonas.demo";
import type { DetalleGrupo } from "../../detalle/models/detalle.model";
import { detalleDemoSource } from "../../detalle/sources/detalle.demo";
import { productosDemoSource } from "../../productos/sources/productos.demo";
import { publicidadDemoSource } from "../../publicidad/sources/publicidad.demo";
import { grupos } from "../../resumen/resumen-grupos";
import { resumenDemoSource } from "../../resumen/sources/resumen.demo";
import { PANEL_ROLE_POLICIES } from "../../shared/config/panel-roles.config";
import { obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import type { PanelSourceContext } from "../../shared/data/panel-source";
import type { PanelCatalogo } from "../../shared/models/panel-catalog.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import type { PanelCapability, PanelRole } from "../../shared/models/panel-role.model";
import { addDays } from "../../shared/utils/lima-time";
import type { VistaComparativo } from "../models/canales-comparativo.model";
import { canalesComparativoDemoSource, canalesDetalleDemoSource } from "../sources/canales.demo";

const NOW = new Date("2026-09-21T21:00:00Z").getTime();

const CATALOGO: PanelCatalogo = {
  listo: true,
  tiendas: [
    { id: "t1", nombre: "Tienda 1" },
    { id: "t2", nombre: "Tienda 2" },
  ],
  canales: [],
  asesores: [
    { id: "a1", nombre: "Asesora 1" },
    { id: "a2", nombre: "Asesora 2" },
  ],
};

const MES: PanelQuery = {
  desde: "2026-09-01",
  hasta: "2026-09-21",
  anterior_desde: "2026-08-01",
  anterior_hasta: "2026-08-21",
  zona_horaria: "America/Lima",
};

const ctx = (role: PanelRole = "dueno"): PanelSourceContext => ({
  role,
  capabilities: new Set<PanelCapability>(PANEL_ROLE_POLICIES[role].capacidades),
  now: NOW,
  catalogo: CATALOGO,
});

const universo = () => obtenerUniversoDemo(CATALOGO, NOW);
const canalDe = (familia: string) => {
  const canal = universo().canales.find((item) => item.familia === familia);
  if (!canal) throw new Error(`Sin canal ${familia}`);
  return canal;
};

const comparativo = async (
  vista: VistaComparativo,
  query: PanelQuery = MES,
  role: PanelRole = "dueno",
) => (await canalesComparativoDemoSource.fetch({ ...query, vista }, ctx(role))).actual;

const detalleCanal = async (canalId: string, role: PanelRole = "dueno", query: PanelQuery = MES) =>
  (await canalesDetalleDemoSource.fetch({ ...query, canal_id: canalId }, ctx(role))).actual;

const drawer = async (grupo: DetalleGrupo, query: PanelQuery = MES) =>
  detalleDemoSource.fetch(
    {
      ...query,
      grupo: grupo.tipo,
      grupo_params: JSON.stringify(grupo.params),
      pagina: 1,
      tamano_pagina: 10_000,
    },
    ctx(),
  );

describe("Canales · comparativo", () => {
  it("las filas por canal (incluida «Sin canal») suman Vendí de Resumen con los mismos filtros", async () => {
    for (const filtro of [{}, { tienda: "t2" }, { zona: "provincia" as const }]) {
      const query = { ...MES, ...filtro };
      const ventas = await comparativo("ventas", query);
      const { actual } = await resumenDemoSource.fetch(query, ctx());
      if (ventas.vista !== "ventas") throw new Error("vista");
      expect(ventas.filas.reduce((suma, fila) => suma + fila.facturacion, 0)).toBe(
        actual.vendi.facturacion,
      );
      expect(ventas.total.facturacion).toBe(actual.vendi.facturacion);
      expect(ventas.total.ventas).toBe(actual.vendi.ventas);
      expect(ventas.filas.some((fila) => fila.canalId === null)).toBe(true);
    }
  });

  it("solo los canales lead informan leads y confirmación", async () => {
    const ventas = await comparativo("ventas");
    if (ventas.vista !== "ventas") throw new Error("vista");
    const fichas = new Map(ventas.canales.map((ficha) => [ficha.id, ficha]));
    for (const fila of ventas.filas) {
      const esLead = fila.canalId ? fichas.get(fila.canalId)?.entrada === "lead" : false;
      expect(fila.leads === null).toBe(!esLead);
    }
  });

  it("entregas: efectividad n/a para presencial y sin flete para la Supervisora", async () => {
    const pos = canalDe("Presencial");
    const dueno = await comparativo("entregas");
    const supervisora = await comparativo("entregas", MES, "supervisora");
    if (dueno.vista !== "entregas" || supervisora.vista !== "entregas") throw new Error("vista");
    expect(dueno.filas.find((fila) => fila.canalId === pos.id)?.efectividadEntrega).toBeNull();
    expect(dueno.filas.every((fila) => typeof fila.flete === "number")).toBe(true);
    expect(supervisora.filas.every((fila) => fila.flete === undefined)).toBe(true);
    expect(supervisora.total.flete).toBeUndefined();
  });

  it("ganancia solo para el Dueño y su pauta cuadra con Publicidad y con Gané", async () => {
    await expect(comparativo("ganancia", MES, "supervisora")).rejects.toThrow("403");
    const ganancia = await comparativo("ganancia");
    if (ganancia.vista !== "ganancia") throw new Error("vista");
    const publicidad = (await publicidadDemoSource.fetch(MES, ctx())).actual;
    const { actual } = await resumenDemoSource.fetch(MES, ctx());
    const pauta = ganancia.total.pautaDirecta + ganancia.total.pautaGeneralEstimada;
    expect(pauta).toBeCloseTo(publicidad.kpis.invertido, 1);
    expect(actual.gane?.publicidad).toBeCloseTo(publicidad.kpis.invertido, 1);
    expect(ganancia.total.gananciaParcial).toBe(true);
    const aliada = canalDe("Plataforma aliada");
    expect(ganancia.filas.find((fila) => fila.canalId === aliada.id)?.retornoPublicidad).toBeNull();
    expect(ganancia.filas.find((fila) => fila.canalId === aliada.id)?.costoPorVenta).toBeNull();
  });

  it("la tendencia muestra como máximo 3 familias más «Otras»", async () => {
    const ventas = await comparativo("ventas");
    expect(ventas.tendencia.length).toBeLessThanOrEqual(4);
    expect(
      ventas.tendencia
        .filter((serie) => serie.agrupada)
        .every((serie) => serie.familia === "Otras"),
    ).toBe(true);
    expect(ventas.tendencia[0].valores).toHaveLength(12);
  });
});

describe("Canales · detalle por tipo", () => {
  it("los KPI del canal coinciden con su fila del comparativo y con su detalle", async () => {
    const ventas = await comparativo("ventas");
    if (ventas.vista !== "ventas") throw new Error("vista");
    for (const ficha of ventas.canales) {
      const detalle = await detalleCanal(ficha.id);
      const fila = ventas.filas.find((item) => item.canalId === ficha.id);
      expect(detalle.kpis.facturacion).toBe(fila?.facturacion);
      expect(detalle.kpis.ventas).toBe(fila?.ventas);
      expect((await drawer(grupos.ventasCanal(ficha.id, ficha.nombre))).resumen.facturacion).toBe(
        fila?.facturacion,
      );
    }
  });

  it("lead: embudo y pérdidas abren exactamente sus pedidos", async () => {
    const lead = canalDe("Online COD");
    const detalle = await detalleCanal(lead.id);
    if (detalle.bloque.tipo !== "lead") throw new Error("bloque");
    const etapa = (nombre: string) =>
      detalle.bloque.tipo === "lead"
        ? detalle.bloque.embudo.find((item) => item.etapa === nombre)?.pedidos
        : 0;
    expect((await drawer(grupos.de("leads", "", { canal: lead.id }))).pedidos.total).toBe(
      etapa("recibidos"),
    );
    expect((await drawer(grupos.de("contactados", "", { canal: lead.id }))).pedidos.total).toBe(
      etapa("contactados"),
    );
    expect((await drawer(grupos.de("entregados", "", { canal: lead.id }))).pedidos.total).toBe(
      etapa("entregados"),
    );
    for (const perdida of detalle.bloque.perdidas) {
      const grupo = grupos.de("perdidas", "", {
        canal: lead.id,
        tipo: perdida.tipo,
        motivo: perdida.motivo,
      });
      expect((await drawer(grupo)).pedidos.total).toBe(perdida.pedidos);
    }
  });

  it("live: las sesiones atribuyen al canal de origen aunque se cierren por otro canal", async () => {
    const live = canalDe("Live");
    const detalle = await detalleCanal(live.id);
    if (detalle.bloque.tipo !== "live") throw new Error("bloque");
    const sesiones = detalle.bloque.sesiones;
    expect(sesiones.length).toBeGreaterThan(0);
    expect(sesiones.reduce((suma, sesion) => suma + sesion.facturacion, 0)).toBe(
      detalle.kpis.facturacion,
    );
    expect(sesiones.some((sesion) => sesion.cerradosPorOtroCanal > 0)).toBe(true);
    const sesion = sesiones[0];
    const pedidos = await drawer(
      grupos.de("ventas", "", { canal: live.id, sesion: sesion.sesionId }),
    );
    expect(pedidos.resumen.facturacion).toBe(sesion.facturacion);
    expect(pedidos.pedidos.filas.every((fila) => fila.canalOrigenId === live.id)).toBe(true);
  });

  it("presencial: el cierre de caja suma la facturación del canal por día y método", async () => {
    const pos = canalDe("Presencial");
    const detalle = await detalleCanal(pos.id);
    if (detalle.bloque.tipo !== "presencial") throw new Error("bloque");
    expect(detalle.bloque.cierres.reduce((suma, dia) => suma + dia.total, 0)).toBe(
      detalle.kpis.facturacion,
    );
    const dia = detalle.bloque.cierres[0];
    expect(Object.values(dia.porMetodo).reduce((suma, monto) => suma + monto, 0)).toBe(dia.total);
    expect(detalle.kpis.efectividadEntrega).toBeNull();
    expect(detalle.kpis.cobradoEnCaja).toBe(detalle.kpis.facturacion);
  });

  it("marketplace y prepago ocultan comisión y pasarela a la Supervisora", async () => {
    const mkp = canalDe("Marketplace");
    const pre = canalDe("Online prepago");
    const mkpDueno = await detalleCanal(mkp.id);
    const mkpSup = await detalleCanal(mkp.id, "supervisora");
    if (mkpDueno.bloque.tipo !== "marketplace" || mkpSup.bloque.tipo !== "marketplace")
      throw new Error("bloque");
    expect(mkpDueno.bloque.netoARecibir).toBeCloseTo(
      mkpDueno.bloque.porLiquidarBruto - (mkpDueno.bloque.comisionADescontar ?? 0),
      2,
    );
    expect(mkpSup.bloque.comisionADescontar).toBeUndefined();
    expect(mkpSup.costos).toBeUndefined();
    expect("comisionPct" in mkpSup.ficha).toBe(false);
    expect("pasarelaPct" in mkpSup.ficha).toBe(false);
    const preSup = await detalleCanal(pre.id, "supervisora");
    if (preSup.bloque.tipo !== "prepago") throw new Error("bloque");
    expect(preSup.bloque.pasarela).toBeUndefined();
    const reembolsos = await drawer(grupos.de("reembolsados", "", { canal: pre.id }));
    expect(reembolsos.pedidos.total).toBe(preSup.bloque.pedidosReembolsados);
  });

  it("conversacional: las vendedoras suman la facturación del canal", async () => {
    const conv = canalDe("Conversacional");
    const detalle = await detalleCanal(conv.id);
    if (detalle.bloque.tipo !== "conversacional") throw new Error("bloque");
    expect(detalle.bloque.vendedoras.reduce((suma, fila) => suma + fila.facturacion, 0)).toBe(
      detalle.kpis.facturacion,
    );
  });
});

describe("Productos", () => {
  it("productos, categorías y ventas diarias cuadran con la facturación neta", async () => {
    const { actual } = await productosDemoSource.fetch(MES, ctx());
    const { actual: resumen } = await resumenDemoSource.fetch(MES, ctx());
    expect(actual.kpis.facturacionNeta).toBe(resumen.vendi.facturacion);
    expect(actual.productos.reduce((suma, fila) => suma + fila.facturacionNeta, 0)).toBe(
      actual.kpis.facturacionNeta,
    );
    expect(actual.categorias.reduce((suma, fila) => suma + fila.facturacionNeta, 0)).toBe(
      actual.kpis.facturacionNeta,
    );
    expect(actual.productos.reduce((suma, fila) => suma + fila.unidades, 0)).toBe(
      actual.kpis.unidades,
    );
    expect(actual.ventasDiarias.reduce((suma, dia) => suma + dia.facturacion, 0)).toBe(
      actual.kpis.facturacionNeta,
    );
  });

  it("la variante es un producto propio que conserva su producto base", async () => {
    const { actual } = await productosDemoSource.fetch(MES, ctx());
    const variante = actual.productos.find((fila) => fila.variante !== null);
    expect(variante).toBeDefined();
    const base = actual.productos.find((fila) => fila.productoId === variante?.productoBaseId);
    expect(base?.variante).toBeNull();
    expect(variante?.sku).not.toBe(base?.sku);
  });

  it("sin costo el margen es null (—), nunca 0% ni 100%; la Supervisora no recibe costo ni margen", async () => {
    const { actual } = await productosDemoSource.fetch(MES, ctx());
    const sinCosto = actual.productos.filter((fila) => fila.costoUnitario === null);
    expect(sinCosto.length).toBeGreaterThan(0);
    expect(sinCosto.every((fila) => fila.margen === null)).toBe(true);
    const supervisora = (await productosDemoSource.fetch(MES, ctx("supervisora"))).actual;
    expect(
      supervisora.productos.every(
        (fila) => fila.costoUnitario === undefined && fila.margen === undefined,
      ),
    ).toBe(true);
  });

  it("cada producto, cupón, categoría y el upsell abren sus pedidos", async () => {
    const { actual } = await productosDemoSource.fetch(MES, ctx());
    const producto = actual.productos[0];
    const pedidos = await drawer(
      grupos.de("ventas", producto.nombre, { producto: producto.productoId }),
    );
    expect(
      pedidos.porProducto.find((fila) => fila.productoId === producto.productoId)?.facturacionNeta,
    ).toBe(producto.facturacionNeta);
    for (const cupon of actual.cupones) {
      const detalle = await drawer(grupos.de("ventas", cupon.cupon, { cupon: cupon.cupon }));
      expect(detalle.resumen.facturacion).toBe(cupon.facturacion);
    }
    const upsell = await drawer(grupos.de("con_upsell", "Upsell"));
    expect(upsell.resumen.ventas).toBe(actual.kpis.ventasConUpsell);
    const perdidos = await drawer(grupos.de("anulados_rechazados", ""));
    expect(perdidos.pedidos.total).toBe(actual.kpis.anuladosMasRechazados);
  });
});

describe("Publicidad", () => {
  it("la pauta general registrada = estimada repartida + sin asignar", async () => {
    const { actual } = await publicidadDemoSource.fetch(MES, ctx());
    expect(actual.kpis.pautaGeneralEstimada + actual.kpis.pautaGeneralSinAsignar).toBeCloseTo(
      actual.kpis.pautaGeneralRegistrada,
      1,
    );
    expect(actual.porCanal.reduce((suma, fila) => suma + fila.totalInvertido, 0)).toBeCloseTo(
      actual.kpis.invertido,
      1,
    );
  });

  it("sin inversión, retorno y costo por venta son null (—)", async () => {
    const pos = canalDe("Presencial");
    const { actual } = await publicidadDemoSource.fetch({ ...MES, canal: pos.id }, ctx());
    expect(actual.kpis.invertido).toBe(0);
    expect(actual.kpis.retornoPublicidad).toBeNull();
    expect(actual.kpis.costoPorVenta).toBeNull();
  });

  it("informa que la inversión no se separa por zona, turno o asesor", async () => {
    expect(
      (await publicidadDemoSource.fetch({ ...MES, zona: "lima" }, ctx())).actual
        .inversionNoSeparable,
    ).toBe(true);
    expect((await publicidadDemoSource.fetch(MES, ctx())).actual.inversionNoSeparable).toBe(false);
  });

  it("la Supervisora no recibe comisiones ni ganancia", async () => {
    const { actual } = await publicidadDemoSource.fetch(MES, ctx("supervisora"));
    expect(actual.kpis.comisionesPlataformas).toBeUndefined();
    expect(
      actual.porCanal.every((fila) => fila.comision === undefined && fila.ganancia === undefined),
    ).toBe(true);
  });
});

describe("Clientes y zonas", () => {
  it("nuevos + recurrentes = clientes con compra; zonas, departamentos y métodos cuadran", async () => {
    const { actual } = await clientesZonasDemoSource.fetch(MES, ctx());
    const { actual: resumen } = await resumenDemoSource.fetch(MES, ctx());
    expect((actual.kpis.nuevos ?? 0) + (actual.kpis.recurrentes ?? 0)).toBe(actual.kpis.conCompra);
    expect(actual.departamentos.reduce((suma, fila) => suma + fila.ventas, 0)).toBe(
      resumen.vendi.ventas,
    );
    expect(actual.zonas.reduce((suma, fila) => suma + fila.facturacion, 0)).toBe(
      resumen.vendi.facturacion,
    );
    expect(actual.metodosPago.reduce((suma, fila) => suma + fila.facturacion, 0)).toBe(
      resumen.vendi.facturacion,
    );
    expect(actual.kpis.listaNegraPedidos).toBe(resumen.clientes.listaNegra);
  });

  it("departamentos, métodos y mejores clientes abren su grupo", async () => {
    const { actual } = await clientesZonasDemoSource.fetch(MES, ctx());
    const departamento = actual.departamentos[0];
    expect(
      (await drawer(grupos.de("ventas", "", { departamento: departamento.departamento }))).resumen
        .ventas,
    ).toBe(departamento.ventas);
    const metodo = actual.metodosPago[0];
    expect(
      (await drawer(grupos.de("ventas", "", { metodo: metodo.metodo }))).resumen.facturacion,
    ).toBe(metodo.facturacion);
    const cliente = actual.mejoresClientes?.[0];
    if (!cliente) throw new Error("cliente");
    expect(
      (await drawer(grupos.historialCliente(cliente.clienteId, cliente.nombre))).pedidos.total,
    ).toBe(cliente.pedidos);
    expect((await drawer(grupos.de("recurrentes", ""))).resumen.ventas).toBeGreaterThan(0);
  });
});

describe("Gráficos de Ventas y canales · marcas clickeables", () => {
  it("cada punto de la tendencia semanal abre exactamente las ventas de esa familia y semana", async () => {
    const ventas = await comparativo("ventas");
    for (const serie of ventas.tendencia) {
      for (const semana of serie.valores.slice(-3)) {
        const detalle = await drawer(
          grupos.rango("", {
            desde: semana.semanaDesde,
            hasta: addDays(semana.semanaDesde, 6),
            familias: serie.familiasIncluidas.join(","),
          }),
        );
        expect(detalle.resumen.facturacion).toBe(semana.facturacion);
      }
    }
  });

  it("un punto de «Vendido» abre las ventas del día en canales con pauta; «Invertido» trae su desglose", async () => {
    const { actual } = await publicidadDemoSource.fetch(MES, ctx());
    for (const dia of actual.porDia.slice(0, 5)) {
      const detalle = await drawer(
        grupos.de("ventas_dia", "", { dia: dia.dia, canales: actual.canalesConPauta.join(",") }),
      );
      expect(detalle.resumen.facturacion).toBe(dia.vendido);
      expect(detalle.pedidos.total).toBe(dia.ventas);
      expect(dia.registros.reduce((suma, registro) => suma + registro.monto, 0)).toBe(
        dia.invertido,
      );
    }
  });
});
