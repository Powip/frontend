import { grupos } from "../../resumen/resumen-grupos";
import { resumenDemoSource } from "../../resumen/sources/resumen.demo";
import {
  AYER,
  abrirGrupo,
  CATALOGO,
  contexto,
  MES,
  NOW,
} from "../../shared/data/demo/__tests__/demo-contexto";
import { obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import { endOfMonthKey } from "../../shared/utils/lima-time";
import {
  finanzasCajaDemoSource,
  finanzasCobranzaDemoSource,
  finanzasResultadoDemoSource,
} from "../sources/finanzas.demo";

const resultado = async (query = MES) =>
  (await finanzasResultadoDemoSource.fetch(query, contexto())).actual;
const caja = async (query = MES) => (await finanzasCajaDemoSource.fetch(query, contexto())).actual;
const cobranza = async (query = MES) =>
  (await finanzasCobranzaDemoSource.fetch(query, contexto())).actual;

describe("Finanzas · Resultado (por fecha del pedido)", () => {
  it("facturado = pagado + por liquidar + en curso + perdido + reembolsado y coincide con Vendí", async () => {
    const { facturadoAlDinero: d } = await resultado();
    const { actual } = await resumenDemoSource.fetch(MES, contexto());
    expect(d.pagado + d.porLiquidar + d.enCurso + d.perdido + d.reembolsado).toBeCloseTo(
      d.facturado,
      2,
    );
    expect(d.facturado).toBe(actual.vendi.facturacion);
    expect(d.entregado).toBe(actual.entregado.entregado);
    expect(d.adelantosRecibidos).toBeNull();
  });

  it("la ganancia es la misma que «Gané» y la publicidad se separa en directa y general estimada", async () => {
    const { estadoResultados: er } = await resultado();
    const gane = (await resumenDemoSource.fetch(MES, contexto())).actual.gane;
    expect(er.ganancia).toBe(gane?.ganancia);
    expect(er.publicidadDirecta + er.publicidadGeneralEstimada).toBeCloseTo(
      gane?.publicidad ?? 0,
      1,
    );
    expect(
      er.ventaEntregada -
        er.costoProducto -
        er.publicidadDirecta -
        er.publicidadGeneralEstimada -
        er.envios -
        er.comisiones,
    ).toBeCloseTo(er.ganancia, 0);
    expect(er.gananciaParcial).toBe(er.entregasSinCosto > 0);
    expect(er.utilidadOperativa).toBeCloseTo(er.ganancia - (er.gastosFijos ?? 0), 2);
  });

  it("con filtros de canal, zona o asesora los gastos fijos quedan pendientes, nunca repartidos", async () => {
    const { estadoResultados: er, puntoEquilibrio } = await resultado({ ...MES, zona: "lima" });
    expect(er.gastosFijos).toBeNull();
    expect(er.utilidadOperativa).toBeNull();
    expect(puntoEquilibrio.entregasNecesarias).toBeNull();
  });

  it("el punto de equilibrio usa la ganancia por entrega", async () => {
    const { puntoEquilibrio: pe, estadoResultados: er } = await resultado();
    expect(pe.gananciaPorEntrega).toBeCloseTo(er.ganancia / pe.entregasLogradas, 6);
    expect(pe.entregasNecesarias).toBe(
      Math.ceil((er.gastosFijos ?? 0) / (pe.gananciaPorEntrega ?? 1)),
    );
  });

  it("la evolución mensual no depende del periodo y cada mes abre sus pedidos", async () => {
    const mes = await resultado(MES);
    const ayer = await resultado(AYER);
    expect(ayer.evolucionMensual).toEqual(mes.evolucionMensual);
    const ultimo = mes.evolucionMensual.at(-1);
    if (!ultimo) throw new Error("sin meses");
    expect(ultimo.enCurso).toBe(true);
    const desde = `${ultimo.mes}-01`;
    const detalle = await abrirGrupo(grupos.rango("", { desde, hasta: endOfMonthKey(desde) }));
    expect(detalle.resumen.facturacion).toBe(ultimo.facturado);
  });

  it("es solo del Dueño", async () => {
    await expect(finanzasResultadoDemoSource.fetch(MES, contexto("supervisora"))).rejects.toThrow(
      "403",
    );
    await expect(finanzasCajaDemoSource.fetch(MES, contexto("supervisora"))).rejects.toThrow("403");
    await expect(finanzasCobranzaDemoSource.fetch(MES, contexto("supervisora"))).rejects.toThrow(
      "403",
    );
  });
});

describe("Finanzas · Caja (por fecha del dinero)", () => {
  it("neto = entró − salió y la suma por día cuadra con lo que entró", async () => {
    const c = await caja();
    expect(c.totalEntro).toBeCloseTo(
      c.entradas.reduce((suma, fila) => suma + (fila.monto ?? 0), 0),
      1,
    );
    expect(c.netoCaja).toBeCloseTo(c.totalEntro - c.totalSalio, 1);
    expect(c.porDia.reduce((suma, dia) => suma + dia.entro, 0)).toBeCloseTo(c.totalEntro, 0);
    expect(c.entradas.find((fila) => fila.concepto === "adelantos")?.monto).toBeNull();
    expect(c.incluyeComprasMercaderia).toBe(false);
  });

  it("cada concepto con pedidos abre esos pedidos, incluidos los ingresados antes del periodo", async () => {
    const c = await caja();
    for (const fila of [...c.entradas, ...c.salidas].filter((item) => item.pedidos)) {
      const detalle = await abrirGrupo(grupos.caja("", { concepto: fila.concepto }));
      expect(detalle.pedidos.total).toBe(fila.pedidos);
    }
    const liquidaciones = await abrirGrupo(grupos.caja("", { concepto: "liquidacion_courier" }));
    expect(liquidaciones.pedidos.filas.some((fila) => fila.ingreso.slice(0, 10) < MES.desde)).toBe(
      true,
    );
  });

  it("el marketplace entra neto de comisión y el prepago entra al cobrarse", async () => {
    const c = await caja();
    const universo = obtenerUniversoDemo(CATALOGO, NOW);
    const detalle = await abrirGrupo(grupos.caja("", { concepto: "liquidacion_marketplace" }));
    const brutos = detalle.pedidos.filas.reduce((suma, fila) => suma + fila.neto, 0);
    const neta = c.entradas.find((fila) => fila.concepto === "liquidacion_marketplace")?.monto ?? 0;
    const comision = universo.canales.find((canal) => canal.cobro === "mkp")?.comisionPct ?? 0;
    expect(neta).toBeCloseTo(brutos * (1 - comision), 0);
    expect(c.entradas.find((fila) => fila.concepto === "prepago")?.monto).toBeGreaterThan(0);
  });
});

describe("Finanzas · Cobranza (estado actual)", () => {
  it("no depende del periodo y la antigüedad suma lo por liquidar", async () => {
    const mes = await cobranza(MES);
    const ayer = await cobranza(AYER);
    expect(ayer).toEqual(mes);
    expect(mes.antiguedad.reduce((suma, fila) => suma + fila.monto, 0)).toBe(mes.kpis.porLiquidar);
    expect(mes.liquidacionesPendientes.reduce((suma, fila) => suma + fila.monto, 0)).toBe(
      mes.kpis.porLiquidar,
    );
    for (const fila of mes.antiguedad.filter((item) => item.pedidos)) {
      const detalle = await abrirGrupo(
        grupos.actual("por_liquidar_actual", "", { antiguedad_deuda: fila.bucket }),
      );
      expect(detalle.pedidos.total).toBe(fila.pedidos);
    }
  });

  it("un courier sin plazo pactado no tiene vencido calculable", async () => {
    const { liquidacionesPendientes, kpis } = await cobranza();
    const sinPlazo = liquidacionesPendientes.find((fila) => fila.plazoDias === null);
    expect(sinPlazo?.vencido).toBeNull();
    expect(kpis.porLiquidarSinPlazo).toBe(sinPlazo?.monto);
    expect(kpis.adelantosDeNoEntregadas).toBeNull();
    const enCurso = await abrirGrupo(grupos.actual("por_cobrar_actual", ""));
    expect(enCurso.pedidos.total).toBe(kpis.pedidosEnCurso);
  });
});
