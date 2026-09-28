import { calcularCuadresDemo } from "../../../configuracion/sources/configuracion.demo";
import {
  finanzasCajaDemoSource,
  finanzasResultadoDemoSource,
} from "../../../finanzas/sources/finanzas.demo";
import { grupos } from "../../../resumen/resumen-grupos";
import { resumenDemoSource } from "../../../resumen/sources/resumen.demo";
import { METAS_INDICADORES_ESPECIFICACION } from "../../config/panel-goals.defaults";
import { META_INDICADOR_IDS } from "../../models/goal.model";
import type { PanelQuery } from "../../models/panel-query.model";
import { evaluarSemaforo } from "../../utils/semaforo";
import { AYER, abrirGrupo, CATALOGO, contexto, MES, NOW } from "../demo/__tests__/demo-contexto";
import { mapaProductos } from "../demo/demo-consultas";
import { costoPedido, estadoDemoEn, obtenerUniversoDemo } from "../demo/demo-universe";

const universo = () => obtenerUniversoDemo(CATALOGO, NOW);
const canalLive = () => universo().canales.find((canal) => canal.esLive)?.id as string;

const COMBINACIONES: [string, PanelQuery, boolean][] = [
  ["sin filtros", MES, true],
  ["tienda", { ...MES, tienda: "t1" }, true],
  ["canal TikTok Live", { ...MES, canal: "__live__" }, false],
  ["entrada lead", { ...MES, entrada: "lead" }, false],
  ["zona Provincia", { ...MES, zona: "provincia" }, true],
  ["rol Vendedora (asesora fija)", { ...MES, asesor: "a1" }, true],
];

describe("§14 · los nueve cuadres con las combinaciones de filtros exigidas", () => {
  for (const [nombre, consulta, pautaCuadra] of COMBINACIONES) {
    it(nombre, () => {
      const query = consulta.canal === "__live__" ? { ...consulta, canal: canalLive() } : consulta;
      const { cuadres } = calcularCuadresDemo(universo(), query, NOW);
      expect(cuadres).toHaveLength(9);
      for (const cuadre of cuadres.filter((item) => item.id !== "pauta_prorrateada")) {
        expect({ cuadre: cuadre.id, cuadra: cuadre.cuadra }).toEqual({
          cuadre: cuadre.id,
          cuadra: true,
        });
      }
      const pauta = cuadres.find((item) => item.id === "pauta_prorrateada");
      if (pautaCuadra) expect(pauta?.cuadra).toBe(true);
      else {
        expect(pauta?.cuadra).toBe(false);
        expect(pauta?.nota).toMatch(/contradicción de §12/);
      }
    });
  }
});

describe("prepago cobrado sin entregar", () => {
  it("no entra en entregados, efectividad ni costo de producto entregado", async () => {
    const enTransito = universo().pedidos.filter((pedido) => {
      if (pedido.dia < MES.desde || pedido.dia > MES.hasta || pedido.ts > NOW) return false;
      const estado = estadoDemoEn(pedido, NOW);
      return (
        pedido.cobro === "pre" && estado.cobro === "pagado" && estado.operativo !== "entregado"
      );
    });
    expect(enTransito.length).toBeGreaterThan(0);
    const entregados = await abrirGrupo(grupos.entregados());
    const ids = new Set(entregados.pedidos.filas.map((fila) => fila.id));
    expect(enTransito.some((pedido) => ids.has(pedido.id))).toBe(false);

    const { actual } = await resumenDemoSource.fetch(MES, contexto());
    const productos = mapaProductos(universo());
    const porId = new Map(universo().pedidos.map((pedido) => [pedido.id, pedido]));
    const costoEntregado = entregados.pedidos.filas.reduce((total, fila) => {
      const pedido = porId.get(fila.id);
      return total + (pedido ? costoPedido(pedido, productos).costo : 0);
    }, 0);
    expect(actual.gane?.costoProducto).toBeCloseTo(costoEntregado, 2);
    const rechazados = await abrirGrupo(grupos.rechazados());
    expect(actual.entregado.efectividadEntrega).toBeCloseTo(
      entregados.pedidos.total / (entregados.pedidos.total + rechazados.pedidos.total),
      10,
    );
  });
});

describe("relojes", () => {
  it("las tareas de hoy son estado actual; Resultado usa fecha del pedido", async () => {
    const mes = (await resumenDemoSource.fetch(MES, contexto())).actual;
    const ayer = (await resumenDemoSource.fetch(AYER, contexto())).actual;
    const actuales = (acciones: typeof mes.acciones) =>
      acciones.filter((accion) => accion.id !== "anulaciones_sin_motivo");
    expect(actuales(ayer.acciones)).toEqual(actuales(mes.acciones));
    const resultadoMes = (await finanzasResultadoDemoSource.fetch(MES, contexto())).actual;
    const resultadoAyer = (await finanzasResultadoDemoSource.fetch(AYER, contexto())).actual;
    expect(resultadoAyer.facturadoAlDinero.facturado).toBeLessThan(
      resultadoMes.facturadoAlDinero.facturado,
    );
  });

  it("el drawer por fecha del dinero suma exactamente lo que muestra Caja, concepto por concepto", async () => {
    const caja = (await finanzasCajaDemoSource.fetch(MES, contexto())).actual;
    for (const fila of [...caja.entradas, ...caja.salidas].filter((item) => item.pedidos)) {
      const detalle = await abrirGrupo(grupos.caja("", { concepto: fila.concepto }));
      expect({ concepto: fila.concepto, monto: detalle.resumen.movimientoCaja }).toEqual({
        concepto: fila.concepto,
        monto: fila.monto,
      });
      expect(
        detalle.pedidos.filas.every(
          (item) => (item.movimientoFecha ?? "").slice(0, 10) >= MES.desde,
        ),
      ).toBe(true);
    }
    const dia = caja.porDia.find((item) => item.entro > 0);
    if (!dia) throw new Error("sin movimientos");
    const detalleDia = await abrirGrupo(grupos.caja("", { dia_cobro: dia.dia }));
    expect(detalleDia.resumen.movimientoCaja).toBeCloseTo(dia.entro, 1);
    expect(
      detalleDia.pedidos.filas.every((item) => item.movimientoFecha?.startsWith(dia.dia)),
    ).toBe(true);
  });
});

describe("semáforos", () => {
  it("nunca es verde si no cumple la meta configurada", () => {
    for (const id of META_INDICADOR_IDS) {
      const meta = METAS_INDICADORES_ESPECIFICACION[id];
      const paso = meta.unidad === "porcentaje" ? 0.001 : 0.5;
      const peor = meta.direccion === "minimo" ? meta.valor - paso * 20 : meta.valor + paso * 20;
      const casi = meta.direccion === "minimo" ? meta.valor - paso * 10 : meta.valor + paso * 10;
      expect(evaluarSemaforo(peor, meta)).not.toBe("cumple");
      expect(evaluarSemaforo(casi, meta)).not.toBe("cumple");
      expect(evaluarSemaforo(meta.valor, meta)).toBe("cumple");
      expect(evaluarSemaforo(null, meta)).toBe("sin_datos");
    }
  });
});
