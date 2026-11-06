import { grupos } from "../../resumen/resumen-grupos";
import {
  AYER,
  abrirGrupo,
  CATALOGO,
  contexto,
  MES,
  NOW,
} from "../../shared/data/demo/__tests__/demo-contexto";
import { bucketEsperaLead, horaLimaDe } from "../../shared/data/demo/demo-consultas";
import { obtenerUniversoDemo, SIN_MOTIVO } from "../../shared/data/demo/demo-universe";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { DEFAULT_PANEL_STATE } from "../../shared/state/panel-state.model";
import { derivePanelView } from "../../shared/utils/derive-panel-view";
import { BUCKETS_ESPERA } from "../models/call-center.model";
import { callCenterDemoSource } from "../sources/call-center.demo";

const HORA = 3_600_000;

const panel = async (query: PanelQuery = MES, ctx = contexto()) =>
  (await callCenterDemoSource.fetch(query, ctx)).actual;

describe("Call center · KPI y denominadores", () => {
  it("leads = confirmados + anulados + pendientes y la confirmación excluye los pendientes", async () => {
    const { kpis } = await panel();
    expect(kpis.confirmados + kpis.anulados + kpis.abiertos).toBe(kpis.leadsRecibidos);
    expect(kpis.abiertos).toBeGreaterThan(0);
    expect(kpis.confirmacion).toBeCloseTo(
      kpis.confirmados / (kpis.confirmados + kpis.anulados),
      10,
    );
    expect(kpis.confirmacion).not.toBeCloseTo(kpis.confirmados / kpis.leadsRecibidos, 3);
  });

  it("contactados usa como denominador los leads ya trabajados y su grupo cuadra", async () => {
    const { kpis } = await panel();
    const universo = obtenerUniversoDemo(CATALOGO, NOW);
    const conIntento = universo.pedidos.filter(
      (pedido) =>
        pedido.entrada === "lead" &&
        pedido.dia >= MES.desde &&
        pedido.dia <= MES.hasta &&
        pedido.ts <= NOW &&
        pedido.tPrimerIntento !== null &&
        pedido.tPrimerIntento <= NOW,
    );
    expect(kpis.trabajados).toBe(conIntento.length);
    expect(kpis.contactacion).toBeCloseTo(kpis.contactados / kpis.trabajados, 10);
    expect((await abrirGrupo(grupos.de("contactados", ""))).pedidos.total).toBe(kpis.contactados);
    expect((await abrirGrupo(grupos.de("leads", ""))).pedidos.total).toBe(kpis.leadsRecibidos);
    expect((await abrirGrupo(grupos.de("leads_confirmados", ""))).pedidos.total).toBe(
      kpis.confirmados,
    );
  });

  it("upsell = confirmados con upsell ÷ confirmados y la 1ª llamada tardía abre sus leads", async () => {
    const { kpis } = await panel();
    expect(kpis.upsellTasa).toBeCloseTo(kpis.confirmadosConUpsell / kpis.confirmados, 10);
    expect(kpis.tiempoPrimeraLlamadaMin).not.toBeNull();
    expect((await abrirGrupo(grupos.de("primera_llamada_tardia", ""))).pedidos.total).toBe(
      kpis.llamadasTardias,
    );
  });
});

describe("Call center · cola de leads por antigüedad", () => {
  it("es una fotografía actual: no cambia con el periodo, sí con los filtros de dimensión", async () => {
    const mes = await panel(MES);
    const ayer = await panel(AYER);
    expect(ayer.colaEspera).toEqual(mes.colaEspera);
    expect(ayer.kpis.porLlamarAhora).toBe(mes.kpis.porLlamarAhora);
    expect(mes.kpis.porLlamarAhora).toBeGreaterThan(0);
    const tienda = await panel({ ...MES, tienda: "t1" });
    expect(tienda.kpis.porLlamarAhora).toBeLessThan(mes.kpis.porLlamarAhora);
  });

  it("cada tramo suma la cola y abre exactamente sus leads con la antigüedad correcta", async () => {
    const { colaEspera, kpis } = await panel();
    expect(colaEspera.map((fila) => fila.bucket)).toEqual([...BUCKETS_ESPERA]);
    expect(colaEspera.reduce((suma, fila) => suma + fila.leads, 0)).toBe(kpis.porLlamarAhora);
    const universo = obtenerUniversoDemo(CATALOGO, NOW);
    const porId = new Map(universo.pedidos.map((pedido) => [pedido.id, pedido]));
    for (const fila of colaEspera) {
      const detalle = await abrirGrupo(
        grupos.actual("cola_leads", "", { antiguedad: fila.bucket }),
        AYER,
      );
      expect(detalle.pedidos.total).toBe(fila.leads);
      for (const pedido of detalle.pedidos.filas) {
        const original = porId.get(pedido.id);
        expect(original && bucketEsperaLead((NOW - original.ts) / HORA)).toBe(fila.bucket);
        expect(pedido.estado).toBe("PENDIENTE");
      }
    }
  });

  it("los límites de los tramos son <1 h, 1–6 h, 6–24 h y >24 h", () => {
    expect(bucketEsperaLead(0.99)).toBe("menos_1h");
    expect(bucketEsperaLead(1)).toBe("1_6h");
    expect(bucketEsperaLead(5.99)).toBe("1_6h");
    expect(bucketEsperaLead(6)).toBe("6_24h");
    expect(bucketEsperaLead(24)).toBe("mas_24h");
  });
});

describe("Call center · motivos, duplicados, lista negra y mapa de calor", () => {
  it("los motivos suman los anulados y «Sin motivo» se marca como error de datos", async () => {
    const { motivosAnulacion, kpis, calidad } = await panel();
    expect(motivosAnulacion.reduce((suma, fila) => suma + fila.leads, 0)).toBe(kpis.anulados);
    const sinMotivo = motivosAnulacion.find((fila) => fila.motivo === SIN_MOTIVO);
    expect(sinMotivo?.sinMotivo).toBe(true);
    expect(sinMotivo?.leads).toBe(calidad.anuladosSinMotivo);
    expect(motivosAnulacion.at(-1)?.sinMotivo).toBe(true);
    for (const fila of motivosAnulacion) {
      const detalle = await abrirGrupo(
        grupos.de("leads_anulados", "", { tipo: "anulado", motivo: fila.motivo }),
      );
      expect(detalle.pedidos.total).toBe(fila.leads);
    }
  });

  it("un duplicado es el mismo cliente y producto en menos de 24 h y queda anulado", async () => {
    const { calidad } = await panel();
    const universo = obtenerUniversoDemo(CATALOGO, NOW);
    const porId = new Map(universo.pedidos.map((pedido) => [pedido.id, pedido]));
    const detalle = await abrirGrupo(grupos.de("duplicados", ""));
    expect(calidad.duplicados).toBeGreaterThan(0);
    expect(detalle.pedidos.total).toBe(calidad.duplicados);
    for (const fila of detalle.pedidos.filas) {
      const duplicado = porId.get(fila.id);
      const original = duplicado?.duplicadoDe ? porId.get(duplicado.duplicadoDe) : undefined;
      expect(original?.clienteId).toBe(duplicado?.clienteId);
      expect(original?.items[0].productoId).toBe(duplicado?.items[0].productoId);
      expect((duplicado?.ts ?? 0) - (original?.ts ?? 0)).toBeLessThan(24 * HORA);
      expect(fila.estado === "ANULADO" || fila.estado === "PENDIENTE").toBe(true);
    }
  });

  it("lista negra compara confirmación y entrega contra el total", async () => {
    const { calidad } = await panel();
    expect(calidad.listaNegra).toBe(
      (await abrirGrupo(grupos.de("leads_lista_negra", ""))).pedidos.total,
    );
    expect(calidad.confirmacionListaNegra).not.toBeNull();
    expect(calidad.confirmacionListaNegra ?? 1).toBeLessThan(calidad.confirmacionTotal ?? 0);
  });

  it("el mapa de calor suma los leads y cada celda abre sus leads en hora Lima", async () => {
    const { mapaCalor, kpis } = await panel();
    expect(mapaCalor.reduce((suma, celda) => suma + celda.leads, 0)).toBe(kpis.leadsRecibidos);
    const celda = [...mapaCalor].sort((a, b) => b.leads - a.leads)[0];
    expect(celda.confirmacion).toBeCloseTo(
      celda.confirmados / (celda.confirmados + celda.anulados),
      10,
    );
    const detalle = await abrirGrupo(
      grupos.de("leads", "", { dia_semana: String(celda.diaSemana), hora: String(celda.hora) }),
    );
    expect(detalle.pedidos.total).toBe(celda.leads);
    const universo = obtenerUniversoDemo(CATALOGO, NOW);
    const porId = new Map(universo.pedidos.map((pedido) => [pedido.id, pedido]));
    for (const fila of detalle.pedidos.filas) {
      const lima = horaLimaDe(porId.get(fila.id)?.ts ?? 0);
      expect(lima).toEqual({ diaSemana: celda.diaSemana, hora: celda.hora });
      expect(fila.ingreso.slice(11, 13)).toBe(String(celda.hora).padStart(2, "0"));
    }
  });
});

describe("Call center · ranking de confirmadoras", () => {
  it("los asignados suman los leads y la entrega usa solo lo que confirmó cada persona", async () => {
    const { ranking, kpis } = await panel();
    expect(ranking.reduce((suma, fila) => suma + fila.asignados, 0)).toBe(kpis.leadsRecibidos);
    for (const fila of ranking.filter((item) => item.asesorId)) {
      const asesor = fila.asesorId as string;
      const entregados = await abrirGrupo(grupos.de("entregados", "", { asesor, entrada: "lead" }));
      const rechazados = await abrirGrupo(grupos.de("rechazados", "", { asesor, entrada: "lead" }));
      expect(entregados.pedidos.total).toBe(fila.entregadosDeConfirmados);
      expect(rechazados.pedidos.total).toBe(fila.rechazadosDeConfirmados);
      expect(fila.entregaDeLoConfirmado).toBeCloseTo(
        fila.entregadosDeConfirmados /
          (fila.entregadosDeConfirmados + fila.rechazadosDeConfirmados),
        10,
      );
      const confirmados = await abrirGrupo(grupos.de("leads_confirmados", "", { asesor }));
      expect(confirmados.pedidos.total).toBe(fila.confirmados);
    }
  });
});

describe("Call center · aislamiento de la Confirmadora", () => {
  it("fuerza su identidad aunque la consulta pida otra asesora", async () => {
    const propio = await panel({ ...MES, asesor: "a2" }, contexto("confirmadora", "a1"));
    expect(propio.ranking.every((fila) => fila.asesorId === "a1")).toBe(true);
    expect(propio.miDia?.asesorId).toBe("a1");
    const dueno = await panel({ ...MES, asesor: "a1" });
    expect(propio.kpis).toEqual(dueno.kpis);
    expect(propio.miDia?.miCola).toBe(dueno.kpis.porLlamarAhora);
  });

  it("Mi día compara contra el equipo sin exponer las filas de otras personas", async () => {
    const respuesta = await callCenterDemoSource.fetch(MES, contexto("confirmadora", "a1"));
    const { miDia } = respuesta.actual;
    const equipo = await panel(MES);
    expect(miDia?.confirmacionEquipo).toBeCloseTo(
      equipo.ranking
        .filter((fila) => fila.asesorId)
        .reduce((suma, fila) => suma + fila.confirmados, 0) /
        equipo.ranking
          .filter((fila) => fila.asesorId)
          .reduce((suma, fila) => suma + fila.confirmados + fila.anulados, 0),
      10,
    );
    expect(miDia?.totalConfirmadoras).toBeGreaterThan(1);
    expect(miDia?.puesto).toBeGreaterThanOrEqual(1);
    expect(Object.keys(respuesta.metas?.mensuales.porConfirmadora ?? {})).toEqual(["a1"]);
  });

  it("sin identidad autorizada responde 403", async () => {
    await expect(callCenterDemoSource.fetch(MES, contexto("confirmadora", null))).rejects.toThrow(
      "403",
    );
  });

  it("el detalle rechaza pedidos de otra asesora y filtra los propios", async () => {
    const ctx = contexto("confirmadora", "a1");
    await expect(
      abrirGrupo(grupos.de("leads", "", { asesor: "a2" }), { ...MES, asesor: "a2" }, ctx),
    ).rejects.toThrow("403");
    const propios = await abrirGrupo(grupos.de("leads", ""), { ...MES, asesor: "a2" }, ctx);
    expect(propios.pedidos.total).toBeGreaterThan(0);
    expect(propios.pedidos.filas.every((fila) => fila.asesor === "Asesora 1")).toBe(true);
  });

  it("ni «Ver como», ni la URL, ni un filtro manual cambian la identidad de una Confirmadora", () => {
    const session = {
      userId: "a1",
      userName: "Asesora 1",
      empresaId: "empresa",
      tiendas: CATALOGO.tiendas,
      rol: {
        status: "resuelto" as const,
        role: "confirmadora" as const,
        source: "rol_jwt" as const,
        evidencia: "prueba",
      },
    };
    const view = derivePanelView(
      {
        ...DEFAULT_PANEL_STATE,
        filters: { ...DEFAULT_PANEL_STATE.filters, asesorId: "a2" },
        preview: { role: "dueno", asesorId: "a2" },
      },
      session,
      NOW,
    );
    if (view.access !== "permitido") throw new Error("vista");
    expect(view.role).toBe("confirmadora");
    expect(view.isPreviewing).toBe(false);
    expect(view.asesorFijo).toBe("a1");
    expect(view.query.asesor).toBe("a1");
    expect(view.query.ver_como).toBeUndefined();
  });
});
