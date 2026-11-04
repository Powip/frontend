import axiosAuth from "@/lib/axiosAuth";
import type { CanalFicha } from "../../canales/models/canal-ficha.model";
import { detalleCallCenterRealSource } from "../../detalle/sources/detalle.source";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import {
  getConfigComisiones,
  getConfigCouriers,
  getConfigGastosFijos,
  getConfigMetas,
  putConfigComisiones,
  putConfigCouriers,
  putConfigGastosFijos,
  putConfigMetas,
  putFichaCanal,
} from "../api/config.api";
import {
  claveRegla,
  cuerpoDeComisiones,
  cuerpoDeCouriers,
  cuerpoDeFicha,
  cuerpoDeGastos,
  cuerpoDeMetas,
  valoresDeComisiones,
  valoresDeCouriers,
  valoresDeFicha,
  valoresDeGastos,
} from "../api/config-cuerpos";
import {
  fraccionAPorcentaje,
  porcentajeAFraccion,
  porcentajeParaEnvio,
} from "../api/config-escala";
import { configCuadresRealSource } from "../sources/config-cuadres.source";
import { configEstadosRealSource } from "../sources/config-estados.source";
import { configMetasRealSource } from "../sources/config-metas.source";
import {
  configComisionesRealSource,
  configCouriersRealSource,
  configGastosFijosRealSource,
} from "../sources/config-reglas.source";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

const mockGet = jest.mocked(axiosAuth.get);
const mockPut = jest.mocked(axiosAuth.put);
const BASE = "https://ventas.example.com";
const CONSULTA: PanelQuery = {
  desde: "2026-10-01",
  hasta: "2026-10-28",
  anterior_desde: "2026-09-03",
  anterior_hasta: "2026-09-30",
  zona_horaria: "America/Lima",
};

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({ data: {} });
  mockPut.mockReset().mockResolvedValue({ data: {} });
  process.env.NEXT_PUBLIC_API_VENTAS = BASE;
});

describe("escala de la ficha de canal (R27)", () => {
  it("el backend responde fracción y el formulario trabaja en 0..100", () => {
    expect(fraccionAPorcentaje(0.125)).toBe(12.5);
    expect(fraccionAPorcentaje(0)).toBe(0);
    expect(fraccionAPorcentaje(1)).toBe(100);
    expect(porcentajeParaEnvio(12.5)).toBe(12.5);
  });

  it("ida y vuelta sin pérdida: fracción → 0..100 → fracción", () => {
    for (const fraccion of [0, 0.005, 0.0725, 0.125, 0.3333, 0.99, 1]) {
      expect(porcentajeAFraccion(fraccionAPorcentaje(fraccion))).toBe(fraccion);
    }
    for (const pct of [0, 0.5, 3.5, 12.5, 99.99, 100]) {
      expect(fraccionAPorcentaje(porcentajeAFraccion(pct))).toBe(pct);
    }
  });

  const ficha = (extra: Partial<CanalFicha> = {}): CanalFicha => ({
    id: "c1",
    nombre: "Mercado Libre",
    clave: "ml",
    familia: "Marketplace",
    color: null,
    entrada: null,
    cobro: null,
    usaCourier: null,
    tipo: "marketplace",
    comisionPct: 0.125,
    pasarelaPct: 0.0725,
    plazoDepositoDias: 7,
    recibePautaGeneral: null,
    metaMensual: null,
    activo: true,
    tienePedidos: null,
    reglasPorConfirmar: false,
    camposPendientes: [],
    ...extra,
  });

  it("leer la ficha y guardarla sin tocar nada no manda nada (ida y vuelta estable)", () => {
    const iniciales = valoresDeFicha(ficha());
    expect(iniciales).toMatchObject({ comision: "12.5", pasarela: "7.25", plazoDeposito: "7" });
    expect(cuerpoDeFicha(iniciales, iniciales)).toEqual({});
  });

  it("el PUT lleva solo lo cambiado y en 0..100 (nunca la fracción)", () => {
    const iniciales = valoresDeFicha(ficha());
    expect(cuerpoDeFicha({ ...iniciales, comision: "15" }, iniciales)).toEqual({ pctComision: 15 });
    expect(cuerpoDeFicha({ ...iniciales, pasarela: "3,5" }, iniciales)).toEqual({
      pctPasarela: 3.5,
    });
    expect(cuerpoDeFicha({ ...iniciales, plazoDeposito: "" }, iniciales)).toEqual({
      plazoDepositoDias: null,
    });
    expect(cuerpoDeFicha({ ...iniciales, tipo: "live", familia: "Live" }, iniciales)).toEqual({
      tipo: "live",
      familia: "Live",
    });
  });

  it("una ficha sin comisión cargada (null) se muestra vacía, no como 0", () => {
    const vacia = valoresDeFicha(ficha({ comisionPct: null, pasarelaPct: null }));
    expect(vacia.comision).toBe("");
    expect(vacia.pasarela).toBe("");
  });
});

describe("cuerpos de guardado: solo lo cambiado", () => {
  it("comisiones: los 4 conceptos exactos y % tal cual (0..100)", () => {
    const iniciales = valoresDeComisiones([
      { rol: "confirmadora", concepto: "por_entrega", valor: 1.5 },
      { rol: "vendedora", concepto: "pct_pagado", valor: 2 },
    ]);
    const valores = {
      ...iniciales,
      [claveRegla("confirmadora", "pct_upsell")]: "10",
      [claveRegla("vendedora", "pct_upsell")]: "5",
      [claveRegla("vendedora", "pct_pagado")]: "2",
    };
    expect(cuerpoDeComisiones(valores, iniciales)).toEqual([
      { rol: "confirmadora", concepto: "pct_upsell", valor: 10 },
      { rol: "vendedora", concepto: "pct_upsell", valor: 5 },
    ]);
  });

  it("gastos fijos y couriers", () => {
    const g = valoresDeGastos([{ storeId: "t1", montoMensual: 100 }]);
    expect(cuerpoDeGastos({ ...g, t2: "50" }, g)).toEqual([{ storeId: "t2", montoMensual: 50 }]);
    const c = valoresDeCouriers([
      { key: "olva", nombre: "Olva", plazoLiquidacionDias: 7, tiempoNormalDias: null },
    ]);
    expect(cuerpoDeCouriers({ ...c, "olva|plazo": "" }, c, ["olva"])).toEqual([
      { key: "olva", plazoLiquidacionDias: null },
    ]);
    expect(cuerpoDeCouriers(c, c, ["olva"])).toEqual([]);
  });

  it("metas: porcentaje de indicador como fracción, mensuales en soles", () => {
    const metas = {
      indicadores: {
        confirmacion: { unidad: "porcentaje" },
        dias_ciclo: { unidad: "dias" },
      },
    } as never;
    const iniciales = {
      "indicador:confirmacion": "65",
      "indicador:dias_ciclo": "4",
      "porCanal:c1": "100",
    };
    expect(
      cuerpoDeMetas(
        {
          ...iniciales,
          "indicador:confirmacion": "70",
          "indicador:dias_ciclo": "5",
          "porCanal:c1": "200",
        },
        iniciales,
        metas,
      ),
    ).toEqual({
      indicadores: { confirmacion: 0.7, dias_ciclo: 5 },
      porCanal: { c1: 200 },
    });
  });
});

describe("ninguna petición de configuración lleva empresaId", () => {
  const sinEmpresa = (valor: unknown) =>
    expect(JSON.stringify(valor ?? null)).not.toMatch(/empresa/i);

  it("lecturas y escrituras de /config/*", async () => {
    await getConfigMetas();
    await getConfigComisiones();
    await getConfigGastosFijos();
    await getConfigCouriers();
    await putConfigMetas({ indicadores: { confirmacion: 0.7 }, porCanal: { c1: 5 } });
    await putConfigComisiones([{ rol: "vendedora", concepto: "pct_pagado", valor: 2 }]);
    await putConfigGastosFijos([{ storeId: "t1", montoMensual: 10 }]);
    await putConfigCouriers([{ key: "olva", plazoLiquidacionDias: 3 }]);
    await putFichaCanal("c1", { pctComision: 12.5 });
    expect(mockGet.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/config/metas`,
      `${BASE}/config/comisiones`,
      `${BASE}/config/gastos-fijos`,
      `${BASE}/config/couriers`,
    ]);
    expect(mockPut.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/config/metas`,
      `${BASE}/config/comisiones`,
      `${BASE}/config/gastos-fijos`,
      `${BASE}/config/couriers`,
      `${BASE}/config/canales/c1/ficha`,
    ]);
    for (const llamada of [...mockGet.mock.calls, ...mockPut.mock.calls]) sinEmpresa(llamada);
  });

  it("las fuentes reales de configuración (incluye estados y cuadres)", async () => {
    const contexto = {} as never;
    await configMetasRealSource.fetch({}, contexto);
    await configComisionesRealSource.fetch({}, contexto);
    await configGastosFijosRealSource.fetch({}, contexto);
    await configCouriersRealSource.fetch({}, contexto);
    await configEstadosRealSource.fetch(CONSULTA, contexto);
    await configCuadresRealSource.fetch(CONSULTA, contexto);
    const urls = mockGet.mock.calls.map((c) => c[0]);
    expect(urls).toContain(`${BASE}/panel/config/estados`);
    expect(urls).toContain(`${BASE}/panel/config/cuadres`);
    for (const llamada of mockGet.mock.calls) sinEmpresa(llamada);
  });

  it("el drawer de primera_llamada_tardia ya es una lectura normal del detalle", async () => {
    mockGet.mockResolvedValue({ data: { pedidos: { filas: [], total: 3 } } });
    const respuesta = await detalleCallCenterRealSource.fetch(
      { ...CONSULTA, grupo: "primera_llamada_tardia", pagina: 1 } as never,
      {} as never,
    );
    expect(mockGet).toHaveBeenCalledWith(
      `${BASE}/panel/detalle`,
      expect.objectContaining({
        params: expect.objectContaining({ grupo: "primera_llamada_tardia" }),
      }),
    );
    expect(respuesta).toMatchObject({ pedidos: { total: 3 } });
  });
});
