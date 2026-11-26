import type { Agregado, AgregadoCanal, AgregadoDia, DiaCanal } from "@/interfaces/IAdministracion";
import {
  agregadosPorCanal,
  agregadosPorMes,
  agregadoVacio,
  canalesDelServidor,
  coberturaFlete,
  notaFlete,
  resultadosVacios,
  resumenDeAgregado,
  serieDiaria,
  serieDiariaCanal,
  sumarAgregados,
  ventasPorCanalServidor,
} from "../servidor";

const agregado = (extra: Partial<Agregado> = {}): Agregado => ({ ...agregadoVacio(), ...extra });

const canal = (nombre: string | null, extra: Partial<Agregado> = {}): AgregadoCanal => ({
  canal: nombre,
  ...agregado(extra),
});

const dia = (d: string, extra: Partial<Agregado> = {}): AgregadoDia => ({ dia: d, ...agregado(extra) });

describe("resumenDeAgregado", () => {
  it("arma el resumen de ventas con cobertura de costo y ticket promedio", () => {
    const r = resumenDeAgregado(
      agregado({
        pedidos: 4,
        monto: 1000,
        unidades: 7,
        costo: 300,
        comisiones: 20,
        sinCosto: { pedidos: 1, monto: 250 },
        costoDudoso: { pedidos: 1, monto: 100 },
      }),
    );
    expect(r).toEqual({
      pedidos: 4,
      monto: 1000,
      unidades: 7,
      costo: 300,
      comisiones: 20,
      sinCosto: { pedidos: 1, monto: 250 },
      costoDudoso: { pedidos: 1, monto: 100 },
      coberturaCosto: 0.75,
      ticketPromedio: 250,
    });
  });

  it("sin ventas no inventa cobertura ni ticket", () => {
    const r = resumenDeAgregado(agregadoVacio());
    expect(r.coberturaCosto).toBeNull();
    expect(r.ticketPromedio).toBeNull();
  });
});

describe("sumarAgregados", () => {
  it("suma todos los campos y redondea los montos a centavos", () => {
    const total = sumarAgregados([
      agregado({
        pedidos: 1,
        monto: 0.1,
        unidades: 2,
        costo: 0.1,
        comisiones: 0.1,
        flete: { monto: 0.1, pedidos: 1 },
        sinCosto: { pedidos: 0, monto: 0 },
        costoDudoso: { pedidos: 1, monto: 0.1 },
      }),
      agregado({
        pedidos: 2,
        monto: 0.2,
        unidades: 3,
        costo: 0.2,
        comisiones: 0.2,
        flete: { monto: 0.2, pedidos: 1 },
        sinCosto: { pedidos: 1, monto: 0.2 },
      }),
    ]);
    expect(total).toEqual({
      pedidos: 3,
      monto: 0.3,
      unidades: 5,
      costo: 0.3,
      comisiones: 0.3,
      flete: { monto: 0.3, pedidos: 2 },
      sinCosto: { pedidos: 1, monto: 0.2 },
      costoDudoso: { pedidos: 1, monto: 0.1 },
    });
    expect(sumarAgregados([])).toEqual(agregadoVacio());
  });
});

describe("flete", () => {
  it("cuenta en cuántas entregas se conoce el flete", () => {
    expect(coberturaFlete(agregado({ pedidos: 50, flete: { monto: 30, pedidos: 3 } }))).toEqual({
      monto: 30,
      conFlete: 3,
      entregas: 50,
      cobertura: 0.06,
    });
    expect(coberturaFlete(agregadoVacio()).cobertura).toBeNull();
  });

  it("con poca cobertura avisa que la utilidad sale sobreestimada", () => {
    expect(notaFlete(coberturaFlete(agregado({ pedidos: 1234, flete: { monto: 30, pedidos: 74 } })))).toEqual({
      texto: "Flete conocido en 74 de 1,234 entregas: el resto no suma envío, así que la utilidad sale sobreestimada",
      baja: true,
    });
    expect(notaFlete(coberturaFlete(agregado({ pedidos: 10, flete: { monto: 90, pedidos: 9 } })))).toEqual({
      texto: "Flete conocido en 9 de 10 entregas",
      baja: false,
    });
    expect(notaFlete(coberturaFlete(agregadoVacio()))).toBeNull();
  });
});

describe("canales", () => {
  const POR_CANAL: AgregadoCanal[] = [
    canal("Falabella", { pedidos: 1, monto: 100, comisiones: 12 }),
    canal("FALABELLA", { pedidos: 3, monto: 300, comisiones: 36, sinCosto: { pedidos: 1, monto: 100 } }),
    canal("LIVE TIKTOK", { pedidos: 2, monto: 50 }),
    canal("TIKTOK_LIVE", { pedidos: 2, monto: 70 }),
    canal(null, { pedidos: 1, monto: 10 }),
  ];

  it("agrupa las grafías de un mismo canal con el formato de canalesEnDatos", () => {
    expect(canalesDelServidor(POR_CANAL)).toEqual([
      { clave: "FALABELLA", nombre: "Falabella", grupo: "marketplace", grafias: ["FALABELLA", "Falabella"], pedidos: 4 },
      {
        clave: "TIKTOK_LIVE",
        nombre: "TikTok Live",
        grupo: "directo",
        grafias: ["LIVE TIKTOK", "TIKTOK_LIVE"],
        pedidos: 4,
      },
      { clave: "SIN_CANAL", nombre: "Sin canal", grupo: "directo", grafias: [], pedidos: 1 },
    ]);
    expect(canalesDelServidor([])).toEqual([]);
  });

  it("suma los agregados por canal normalizado y da el resumen de cada uno", () => {
    const porCanal = agregadosPorCanal(POR_CANAL);
    expect([...porCanal.keys()]).toEqual(["FALABELLA", "TIKTOK_LIVE", "SIN_CANAL"]);
    expect(porCanal.get("FALABELLA")).toMatchObject({ pedidos: 4, monto: 400, comisiones: 48 });

    const ventas = ventasPorCanalServidor(POR_CANAL);
    expect(ventas.get("FALABELLA")).toMatchObject({ monto: 400, ticketPromedio: 100, coberturaCosto: 0.75 });
    expect(ventas.get("TIKTOK_LIVE")).toMatchObject({ pedidos: 4, monto: 120 });
  });
});

describe("series", () => {
  it("serie diaria de todos los canales y de un canal (sumando sus grafías)", () => {
    expect(serieDiaria([dia("2026-11-10", { pedidos: 2, monto: 500, unidades: 4 })])).toEqual(
      new Map([["2026-11-10", { pedidos: 2, monto: 500, unidades: 4 }]]),
    );
    const porDiaCanal: DiaCanal[] = [
      { dia: "2026-11-10", canal: "LIVE TIKTOK", pedidos: 1, monto: 200, unidades: 1 },
      { dia: "2026-11-10", canal: "TIKTOK_LIVE", pedidos: 1, monto: 100.1, unidades: 2 },
      { dia: "2026-11-10", canal: "WHATSAPP", pedidos: 5, monto: 900, unidades: 9 },
      { dia: "2026-11-11", canal: "tiktok live", pedidos: 1, monto: 50, unidades: 1 },
    ];
    expect(serieDiariaCanal(porDiaCanal, "TIKTOK_LIVE")).toEqual(
      new Map([
        ["2026-11-10", { pedidos: 2, monto: 300.1, unidades: 3 }],
        ["2026-11-11", { pedidos: 1, monto: 50, unidades: 1 }],
      ]),
    );
    expect(serieDiariaCanal(porDiaCanal, "RIPLEY").size).toBe(0);
  });

  it("agrupa los días de entrega por mes", () => {
    const meses = agregadosPorMes([
      dia("2026-01-05", { pedidos: 1, monto: 100, flete: { monto: 10, pedidos: 1 } }),
      dia("2026-01-20", { pedidos: 2, monto: 200 }),
      dia("2026-03-01", { pedidos: 1, monto: 50 }),
    ]);
    expect([...meses.keys()]).toEqual(["2026-01", "2026-03"]);
    expect(meses.get("2026-01")).toMatchObject({ pedidos: 3, monto: 300, flete: { monto: 10, pedidos: 1 } });
  });
});

it("la respuesta vacía tiene la forma del contrato", () => {
  expect(resultadosVacios("2026-11-01", "2026-11-30")).toMatchObject({
    desde: "2026-11-01",
    hasta: "2026-11-30",
    fecha: "entrega",
    totales: agregadoVacio(),
    porDia: [],
    calidad: { entregasSinHistorial: 0 },
    enCurso: { pedidos: 0, adelantos: { pedidos: 0, monto: 0 } },
  });
});
