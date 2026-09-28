import { callCenterDemoSource } from "../../call-center/sources/call-center.demo";
import { configMetasDemoSource } from "../../configuracion/sources/config-metas.demo";
import {
  calcularCuadresDemo,
  configCuadresDemoSource,
  configEstadosDemoSource,
} from "../../configuracion/sources/configuracion.demo";
import { estadoPeriodoDemoSource } from "../../estado-periodo/sources/estado-periodo.demo";
import { misVentasDemoSource } from "../../mis-ventas/sources/mis-ventas.demo";
import { grupos } from "../../resumen/resumen-grupos";
import { resumenDemoSource } from "../../resumen/sources/resumen.demo";
import {
  abrirGrupo,
  CATALOGO,
  contexto,
  MES,
  NOW,
} from "../../shared/data/demo/__tests__/demo-contexto";
import { obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import { SIN_ASESOR } from "../../shared/models/panel-filters.model";
import { equipoConfirmadorasDemoSource, equipoVendedorasDemoSource } from "../sources/equipo.demo";

const vendedoras = async (
  agrupar: "zona" | "asesora" = "asesora",
  upsell: "con" | "sin" = "con",
  role: "dueno" | "supervisora" = "dueno",
) => (await equipoVendedorasDemoSource.fetch({ ...MES, agrupar, upsell }, contexto(role))).actual;

describe("Equipo · Vendedoras y caja", () => {
  it("total = pagado + pendiente + perdido y ambas agrupaciones dan el mismo total", async () => {
    const porAsesora = await vendedoras("asesora");
    const porZona = await vendedoras("zona");
    const t = porAsesora.total;
    expect(t.pagado + t.pendiente + t.perdido).toBeCloseTo(t.total, 6);
    expect(porZona.total).toEqual(porAsesora.total);
    expect(porAsesora.grupos.reduce((suma, grupo) => suma + grupo.metricas.pedidos, 0)).toBe(
      t.pedidos,
    );
    for (const grupo of porAsesora.grupos) {
      expect(grupo.hijos.reduce((suma, hijo) => suma + hijo.metricas.pedidos, 0)).toBe(
        grupo.metricas.pedidos,
      );
    }
  });

  it("ventas con asesora + automáticas + leads confirmados = ventas totales", async () => {
    const panel = await vendedoras();
    const { actual } = await resumenDemoSource.fetch(MES, contexto());
    const leads = await abrirGrupo(grupos.de("leads_confirmados", ""));
    expect(panel.total.pedidos + panel.automaticas.ventas + leads.pedidos.total).toBe(
      actual.vendi.ventas,
    );
    const automaticas = await abrirGrupo(
      grupos.de("ventas", "", { asesor: SIN_ASESOR, entrada_no: "lead" }),
    );
    expect(automaticas.pedidos.total).toBe(panel.automaticas.ventas);
  });

  it("cada asesora abre exactamente sus pedidos sin los leads", async () => {
    const panel = await vendedoras();
    for (const grupo of panel.grupos) {
      const detalle = await abrirGrupo(
        grupos.de("ventas", "", { asesor: grupo.asesorId ?? SIN_ASESOR, entrada_no: "lead" }),
      );
      expect(detalle.pedidos.total).toBe(grupo.metricas.pedidos);
    }
  });

  it("«sin upsell» descuenta exactamente el upsell y la Supervisora no recibe comisión", async () => {
    const con = await vendedoras("asesora", "con");
    const sin = await vendedoras("asesora", "sin");
    expect(con.total.total - sin.total.total).toBeCloseTo(con.kpis.upsell, 2);
    expect(con.grupos.every((grupo) => typeof grupo.metricas.comisionEstimada === "number")).toBe(
      true,
    );
    const supervisora = await vendedoras("asesora", "con", "supervisora");
    expect(supervisora.grupos.every((grupo) => grupo.metricas.comisionEstimada === undefined)).toBe(
      true,
    );
    expect(supervisora.total.comisionEstimada).toBeUndefined();
  });
});

describe("Equipo · Confirmadoras", () => {
  it("usa el mismo cálculo que el ranking de Call center", async () => {
    const { actual } = await equipoConfirmadorasDemoSource.fetch(MES, contexto());
    const ranking = (await callCenterDemoSource.fetch(MES, contexto())).actual.ranking;
    for (const fila of actual.filas) {
      const par = ranking.find((item) => item.asesorId === fila.asesorId);
      expect(fila.confirmados).toBe(par?.confirmados);
      expect(fila.confirmacion).toBe(par?.confirmacion);
      expect(fila.efectividadEntrega).toBe(par?.entregaDeLoConfirmado);
      expect(fila.asignados).toBe(par?.asignados);
    }
  });

  it("la Supervisora no recibe comisión ni regla de comisión", async () => {
    const { actual } = await equipoConfirmadorasDemoSource.fetch(MES, contexto("supervisora"));
    expect(actual.reglaComision).toBeUndefined();
    expect(actual.filas.every((fila) => fila.comisionEstimada === undefined)).toBe(true);
  });
});

describe("Mis ventas", () => {
  it("fuerza la identidad de la vendedora y no expone nombres ni comisiones de otras", async () => {
    const { actual } = await misVentasDemoSource.fetch(
      { ...MES, asesor: "a2" },
      contexto("vendedora", "a1"),
    );
    expect(actual.asesorId).toBe("a1");
    expect("comisionEstimada" in actual).toBe(false);
    const otras = actual.ranking.filter((fila) => !fila.esYo);
    expect(otras.every((fila) => /^Vendedora \d+$/.test(fila.nombre))).toBe(true);
    expect(otras.some((fila) => ["a2", "a3"].includes(fila.asesorId))).toBe(false);
    expect(actual.ranking.filter((fila) => fila.esYo)).toHaveLength(1);
    await expect(misVentasDemoSource.fetch(MES, contexto("vendedora", null))).rejects.toThrow(
      "403",
    );
  });

  it("su facturación coincide con su fila de Vendedoras y sus no cobrados están en curso o por liquidar", async () => {
    const { actual } = await misVentasDemoSource.fetch(MES, contexto("vendedora", "a1"));
    const equipo = await vendedoras("asesora", "con");
    expect(actual.vendi.facturacion).toBeCloseTo(
      equipo.grupos.find((grupo) => grupo.asesorId === "a1")?.metricas.total ?? 0,
      6,
    );
    expect(
      actual.noCobrados.every((fila) => fila.cobro === "por_liquidar" || fila.cobro === "en_curso"),
    ).toBe(true);
    expect(actual.porEstado.reduce((suma, fila) => suma + fila.pedidos, 0)).toBe(
      actual.vendi.ventas,
    );
  });
});

describe("Configuración", () => {
  it("sin filtros los 9 cuadres dan ✓ y la línea de estado usa el mismo resultado", async () => {
    const cuadres = await configCuadresDemoSource.fetch(MES, contexto());
    expect(cuadres.cuadres).toHaveLength(9);
    for (const cuadre of cuadres.cuadres.filter((item) => item.id !== "pauta_prorrateada")) {
      expect(cuadre.cuadra).toBe(true);
    }
    const estado = await estadoPeriodoDemoSource.fetch(MES, contexto());
    expect(estado.actual.calidad?.cuadresOk).toBe(
      cuadres.cuadres.filter((item) => item.cuadra).length,
    );
    expect(estado.actual.calidad?.datosCompletos).toBe(cuadres.calidad.porcentajeCompleto);
  });

  it("con filtro de canal el cuadre de pauta no cuadra y lo explica", () => {
    const universo = obtenerUniversoDemo(CATALOGO, NOW);
    const canal = universo.canales.find((item) => item.pautaDirecta);
    const { cuadres } = calcularCuadresDemo(universo, { ...MES, canal: canal?.id }, NOW);
    const pauta = cuadres.find((item) => item.id === "pauta_prorrateada");
    expect(pauta?.cuadra).toBe(false);
    expect(pauta?.nota).toMatch(/contradicción/);
  });

  it("la calidad de datos abre sus pedidos y el conteo por estado suma los ingresados", async () => {
    const { calidad } = await configCuadresDemoSource.fetch(MES, contexto());
    expect((await abrirGrupo(grupos.de("anulaciones_sin_motivo", ""))).pedidos.total).toBe(
      calidad.anulacionesSinMotivo,
    );
    expect((await abrirGrupo(grupos.de("ventas_sin_costo", ""))).pedidos.total).toBe(
      calidad.ventasConProductoSinCosto,
    );
    expect((await abrirGrupo(grupos.de("pedidos", "", { canal: "sin_canal" }))).pedidos.total).toBe(
      calidad.importadosSinCanal,
    );
    expect(calidad.productosStockNegativo.length).toBeGreaterThan(0);
    const estados = await configEstadosDemoSource.fetch(MES, contexto());
    const total = estados.conteoActual.reduce((suma, fila) => suma + fila.pedidos, 0);
    expect((await abrirGrupo(grupos.de("pedidos", ""))).pedidos.total).toBe(total);
    for (const fila of estados.conteoActual.filter((item) => item.pedidos)) {
      expect(
        (await abrirGrupo(grupos.de("pedidos", "", { estado: fila.estado }))).pedidos.total,
      ).toBe(fila.pedidos);
    }
  });

  it("las metas traen los indicadores de §11 y metas mensuales por canal, vendedora y confirmadora", async () => {
    const metas = await configMetasDemoSource.fetch({ empresaId: "e1" }, contexto());
    expect(metas.indicadores.confirmacion.valor).toBe(0.65);
    expect(Object.keys(metas.mensuales.porCanal).length).toBeGreaterThan(0);
    expect(Object.keys(metas.mensuales.porVendedora).length).toBeGreaterThan(0);
    expect(Object.keys(metas.mensuales.porConfirmadora).length).toBeGreaterThan(0);
  });
});
