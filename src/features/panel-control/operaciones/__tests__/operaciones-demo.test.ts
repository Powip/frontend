import { grupos } from "../../resumen/resumen-grupos";
import {
  AYER,
  abrirGrupo,
  CATALOGO,
  contexto,
  MES,
  NOW,
} from "../../shared/data/demo/__tests__/demo-contexto";
import {
  bucketAntiguedadCola,
  ETAPA_META_HORAS,
  horasEtapa,
  inicioEstadoCola,
  mediana,
} from "../../shared/data/demo/demo-consultas";
import {
  COURIER_SIN_PLAZO,
  estadoDemoEn,
  obtenerUniversoDemo,
} from "../../shared/data/demo/demo-universe";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { toLimaDayKey } from "../../shared/utils/lima-time";
import { BUCKETS_ANTIGUEDAD, type EstadoCola, ETAPAS_OPERATIVAS } from "../models/cola.model";
import {
  operacionesColaDemoSource,
  operacionesCouriersDemoSource,
  operacionesInventarioDemoSource,
} from "../sources/operaciones.demo";

const DIA = 24 * 3_600_000;
const universo = () => obtenerUniversoDemo(CATALOGO, NOW);
const porId = () => new Map(universo().pedidos.map((pedido) => [pedido.id, pedido]));

const cola = async (query: PanelQuery = MES, ctx = contexto()) =>
  (await operacionesColaDemoSource.fetch(query, ctx)).actual;
const couriers = async (query: PanelQuery = MES, ctx = contexto()) =>
  (await operacionesCouriersDemoSource.fetch(query, ctx)).actual;
const inventario = async (query: PanelQuery = MES, ctx = contexto()) =>
  (await operacionesInventarioDemoSource.fetch(query, ctx)).actual;

describe("Operaciones · cola y tiempos", () => {
  it("la cola, la matriz, sin guía y retrasados son fotografías actuales", async () => {
    const mes = await cola(MES);
    const ayer = await cola(AYER);
    expect(ayer.matriz).toEqual(mes.matriz);
    expect(ayer.kpis.colaActiva).toBe(mes.kpis.colaActiva);
    expect(ayer.kpis.sinGuiaMas24h).toBe(mes.kpis.sinGuiaMas24h);
    expect(ayer.kpis.enviosRetrasados).toBe(mes.kpis.enviosRetrasados);
    expect(ayer.kpis.incidenciaRechazo).not.toBe(mes.kpis.incidenciaRechazo);
    const provincia = await cola({ ...MES, zona: "provincia" });
    expect(provincia.kpis.colaActiva).toBeLessThan(mes.kpis.colaActiva);
  });

  it("cada celda estado × antigüedad abre exactamente esos pedidos con su acción", async () => {
    const { matriz, kpis } = await cola();
    expect(matriz.reduce((suma, fila) => suma + fila.total, 0)).toBe(kpis.colaActiva);
    const pedidos = porId();
    for (const fila of matriz) {
      expect(
        BUCKETS_ANTIGUEDAD.reduce((suma, bucket) => suma + fila.porAntiguedad[bucket], 0) +
          fila.sinFecha,
      ).toBe(fila.total);
      for (const bucket of BUCKETS_ANTIGUEDAD) {
        const detalle = await abrirGrupo(
          grupos.actual(
            "cola_operativa",
            "",
            { estado: fila.estado, antiguedad: bucket },
            fila.accion,
          ),
          AYER,
        );
        expect(detalle.pedidos.total).toBe(fila.porAntiguedad[bucket]);
        for (const item of detalle.pedidos.filas) {
          const pedido = pedidos.get(item.id);
          const inicio = pedido ? inicioEstadoCola(pedido, fila.estado as EstadoCola) : null;
          expect(item.estado).toBe(fila.estado);
          expect(inicio !== null && bucketAntiguedadCola((NOW - inicio) / DIA)).toBe(bucket);
        }
      }
    }
    expect(matriz.map((fila) => fila.accion)).toEqual([
      "preparar",
      "asignar_guia",
      "coordinar_recojo",
      "reclamar_courier",
    ]);
  });

  it("la antigüedad se cuenta desde que el pedido entró a su estado actual", () => {
    expect(bucketAntiguedadCola(0.99)).toBe("menos_24h");
    expect(bucketAntiguedadCola(1)).toBe("1_2d");
    expect(bucketAntiguedadCola(2.99)).toBe("1_2d");
    expect(bucketAntiguedadCola(3)).toBe("3_5d");
    expect(bucketAntiguedadCola(6)).toBe("mas_5d");
  });

  it("la mediana por etapa usa las entregas del periodo y el exceso sobre la meta abre sus pedidos", async () => {
    const { tiemposPorEtapa, kpis } = await cola();
    const entregas = universo().pedidos.filter(
      (pedido) =>
        pedido.dia >= MES.desde &&
        pedido.dia <= MES.hasta &&
        pedido.ts <= NOW &&
        pedido.usaCourier &&
        estadoDemoEn(pedido, NOW).operativo === "entregado",
    );
    for (const fila of tiemposPorEtapa) {
      const horas = entregas
        .map((pedido) => horasEtapa(pedido, fila.etapa))
        .filter((valor): valor is number => valor !== null);
      expect(fila.medianaHoras).toBeCloseTo(mediana(horas) ?? Number.NaN, 10);
      expect(fila.metaHoras).toBe(ETAPA_META_HORAS[fila.etapa]);
      const lentos = await abrirGrupo(grupos.de("etapa_lenta", "", { etapa: fila.etapa }));
      expect(lentos.pedidos.total).toBe(fila.sobreMeta);
    }
    expect(tiemposPorEtapa.map((fila) => fila.etapa)).toEqual([...ETAPAS_OPERATIVAS]);
    expect(kpis.diasConfirmadoAEntregado).toBeCloseTo(
      (tiemposPorEtapa.find((fila) => fila.etapa === "ciclo_total")?.medianaHoras ?? 0) / 24,
      10,
    );
  });

  it("la mediana de una lista par promedia los dos valores centrales", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
  });

  it("los despachos van por fecha de despacho, no de ingreso, y cada día abre sus pedidos", async () => {
    const { despachosPorDia } = await cola();
    const despachadosEnMes = universo().pedidos.filter(
      (pedido) =>
        pedido.ts <= NOW &&
        pedido.tDesp !== null &&
        pedido.tDesp <= NOW &&
        toLimaDayKey(pedido.tDesp) >= MES.desde &&
        toLimaDayKey(pedido.tDesp) <= MES.hasta &&
        estadoDemoEn(pedido, NOW).venta,
    );
    expect(despachosPorDia.reduce((suma, dia) => suma + dia.despachados, 0)).toBe(
      despachadosEnMes.length,
    );
    expect(despachadosEnMes.some((pedido) => pedido.dia < MES.desde)).toBe(true);
    const dia = despachosPorDia[0];
    const detalle = await abrirGrupo(grupos.despachadosDia(dia.dia));
    expect(detalle.pedidos.total).toBe(dia.despachados);
  });

  it("incidencia = rechazados ÷ (entregados + rechazados) y los motivos suman los rechazos", async () => {
    const { kpis, motivosRechazo } = await cola();
    expect(kpis.incidenciaRechazo).toBeCloseTo(
      kpis.rechazados / (kpis.entregados + kpis.rechazados),
      10,
    );
    expect(motivosRechazo.reduce((suma, fila) => suma + fila.pedidos, 0)).toBe(kpis.rechazados);
    for (const fila of motivosRechazo) {
      const detalle = await abrirGrupo(
        grupos.de("rechazados", "", { tipo: "rechazado", motivo: fila.motivo }),
      );
      expect(detalle.pedidos.filas.every((item) => item.estado === "RECHAZADO")).toBe(true);
      expect(detalle.pedidos.total).toBe(fila.pedidos);
    }
  });
});

describe("Operaciones · couriers", () => {
  it("envíos = entregados + rechazados + en tránsito y cada fila suma el total", async () => {
    const { kpis, couriers: filas } = await couriers();
    expect(kpis.envios).toBe(kpis.entregados + kpis.rechazados + kpis.enTransito);
    expect(filas.reduce((suma, fila) => suma + fila.envios, 0)).toBe(kpis.envios);
    expect((await abrirGrupo(grupos.de("envios", ""))).pedidos.total).toBe(kpis.envios);
    expect(kpis.efectividadEntrega).toBeCloseTo(
      kpis.entregados / (kpis.entregados + kpis.rechazados),
      10,
    );
  });

  it("un prepago cobrado y aún en tránsito no cuenta como entrega efectiva", async () => {
    const prepagosEnTransito = universo().pedidos.filter((pedido) => {
      if (pedido.dia < MES.desde || pedido.dia > MES.hasta || pedido.ts > NOW) return false;
      const estado = estadoDemoEn(pedido, NOW);
      return pedido.cobro === "pre" && estado.cobro === "pagado" && estado.operativo === "en_envio";
    });
    expect(prepagosEnTransito.length).toBeGreaterThan(0);
    const soloPrepago = await couriers({ ...MES, cobro: "pre" });
    const entregados = await abrirGrupo(grupos.de("entregados", ""), { ...MES, cobro: "pre" });
    expect(soloPrepago.kpis.entregados).toBe(entregados.pedidos.total);
    expect(soloPrepago.kpis.enTransito).toBeGreaterThanOrEqual(prepagosEnTransito.length);
    const ids = new Set(entregados.pedidos.filas.map((fila) => fila.id));
    expect(prepagosEnTransito.some((pedido) => ids.has(pedido.id))).toBe(false);
  });

  it("sin dato de primer intento o de plazo muestra null, nunca cero", async () => {
    const { kpis, couriers: filas } = await couriers();
    const marketplace = filas.find((fila) => fila.nombre === "Fulfillment marketplace");
    expect(marketplace?.primerIntento).toBeNull();
    expect(kpis.entregasSinDatoPrimerIntento).toBeGreaterThan(0);
    const sinPlazo = filas.find((fila) => fila.nombre === COURIER_SIN_PLAZO);
    expect(sinPlazo?.plazoLiquidacionDias).toBeNull();
    expect(sinPlazo?.tiempoNormalDias).toBeNull();
    expect(sinPlazo?.vencido).toBeNull();
    expect(kpis.porLiquidarSinPlazo).toBeGreaterThan(0);
  });

  it("por liquidar y vencido son estado actual y abren sus pedidos", async () => {
    const mes = await couriers(MES);
    const ayer = await couriers(AYER);
    expect(ayer.kpis.porLiquidar).toBe(mes.kpis.porLiquidar);
    expect(ayer.kpis.liquidacionVencida).toBe(mes.kpis.liquidacionVencida);
    const todos = await abrirGrupo(grupos.actual("por_liquidar_actual", ""));
    const vencidos = await abrirGrupo(grupos.actual("por_liquidar_actual", "", { vencido: "1" }));
    expect(todos.pedidos.total).toBe(mes.kpis.pedidosPorLiquidar);
    expect(vencidos.pedidos.total).toBe(mes.kpis.pedidosVencidos);
    expect(vencidos.pedidos.filas.every((fila) => fila.vencido)).toBe(true);
  });

  it("el score A–D sale de la efectividad y cada departamento cuadra con los envíos", async () => {
    const { couriers: filas, departamentos, kpis } = await couriers();
    for (const fila of filas.filter((item) => item.efectividad !== null)) {
      const e = fila.efectividad as number;
      const esperado = e >= 0.9 ? "A" : e >= 0.82 ? "B" : e >= 0.75 ? "C" : "D";
      expect(fila.score).toBe(esperado);
    }
    expect(departamentos.reduce((suma, fila) => suma + fila.envios, 0)).toBe(kpis.envios);
  });

  it("la Supervisora no recibe flete ni costo de rechazos", async () => {
    const { kpis, couriers: filas, departamentos } = await couriers(MES, contexto("supervisora"));
    expect(kpis.fleteTotal).toBeUndefined();
    expect(kpis.fletePromedio).toBeUndefined();
    expect(
      filas.every((fila) => fila.fleteTotal === undefined && fila.costoRechazos === undefined),
    ).toBe(true);
    expect(departamentos.every((fila) => fila.fletePromedio === undefined)).toBe(true);
    const dueno = await couriers();
    expect(typeof dueno.kpis.fleteTotal).toBe("number");
  });
});

describe("Operaciones · inventario", () => {
  it("stock negativo es «Error de datos», nunca «Agotado», y no inventa cobertura", async () => {
    const { productos, kpis } = await inventario();
    const errores = productos.filter((fila) => fila.stock < 0);
    expect(errores.length).toBeGreaterThan(0);
    expect(
      errores.every((fila) => fila.estado === "error_datos" && fila.coberturaDias === null),
    ).toBe(true);
    expect(kpis.erroresDatos).toBe(errores.length);
    expect(
      productos.filter((fila) => fila.estado === "agotado").every((fila) => fila.stock >= 0),
    ).toBe(true);
    const esperando = await abrirGrupo(
      grupos.actual("accion", "", { accion: "productos_agotados" }, "avisar_cliente"),
    );
    expect(esperando.pedidos.total).toBe(kpis.ventasEsperandoStock);
  });

  it("disponible = stock − reservado y el reservado abre sus pedidos (LLAMADO a CON_GUIA)", async () => {
    const { productos } = await inventario({ ...MES, tienda: "t1" });
    const fila = productos.find((item) => (item.reservado ?? 0) > 0);
    if (!fila) throw new Error("sin reservas");
    expect(fila.disponible).toBe(fila.stock - (fila.reservado ?? 0));
    const detalle = await abrirGrupo(
      grupos.actual("reservados", "", { producto: fila.productoId }),
      {
        ...MES,
        tienda: "t1",
      },
    );
    expect(
      detalle.pedidos.filas.every((item) =>
        ["LLAMADO", "PREPARADO", "CON_GUIA"].includes(item.estado),
      ),
    ).toBe(true);
    expect(detalle.porProducto.find((item) => item.productoId === fila.productoId)?.unidades).toBe(
      fila.reservado,
    );
  });

  it("el valor al costo es solo del Dueño y un producto sin costo muestra null", async () => {
    const dueno = await inventario();
    expect(typeof dueno.kpis.valorAlCosto).toBe("number");
    expect(dueno.productos.some((fila) => fila.costoUnitario === null && fila.valor === null)).toBe(
      true,
    );
    const supervisora = await inventario(MES, contexto("supervisora"));
    expect(supervisora.kpis.valorAlCosto).toBeUndefined();
    expect(
      supervisora.productos.every(
        (fila) => fila.costoUnitario === undefined && fila.valor === undefined,
      ),
    ).toBe(true);
  });
});
