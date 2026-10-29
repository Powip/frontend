import axiosAuth from "@/lib/axiosAuth";
import { detalleRealSource } from "../../../detalle/sources/detalle.source";
import { estadoPeriodoRealSource } from "../../../estado-periodo/sources/estado-periodo.source";
import { resumenRealSource } from "../../../resumen/sources/resumen.source";
import type { PanelQuery } from "../../models/panel-query.model";
import { getPanel } from "../panel-http";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockGet = jest.mocked(axiosAuth.get);
const CONSULTA: PanelQuery = {
  desde: "2026-10-01",
  hasta: "2026-10-28",
  anterior_desde: "2026-09-03",
  anterior_hasta: "2026-09-30",
  zona_horaria: "America/Mendoza",
  tienda: "tienda-1",
  entrada: "lead",
};
const CONTEXTO = {} as never;

beforeEach(() => {
  mockGet.mockReset();
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.example.com";
});

describe("fuentes reales del panel (ms-ventas)", () => {
  it("getPanel pide /panel/<ruta> con los filtros tal cual, sin tocar el token", async () => {
    mockGet.mockResolvedValue({ data: { ok: true } });
    await expect(getPanel("resumen", CONSULTA)).resolves.toEqual({ ok: true });
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/resumen", {
      params: CONSULTA,
    });
  });

  it.each([
    [estadoPeriodoRealSource, "estado-periodo", "estado"],
    [resumenRealSource, "resumen", "resumen"],
  ] as const)("%# %s lee GET /panel/%s", async (fuente, contrato, ruta) => {
    const sobre = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };
    mockGet.mockResolvedValue({ data: sobre });
    expect(fuente.kind).toBe("real");
    expect(fuente.contractId).toBe(contrato);
    await expect(fuente.fetch(CONSULTA as never, CONTEXTO)).resolves.toBe(sobre);
    expect(mockGet).toHaveBeenCalledWith(
      `https://ventas.example.com/panel/${ruta}`,
      expect.objectContaining({
        params: expect.objectContaining({ zona_horaria: "America/Mendoza", tienda: "tienda-1" }),
      }),
    );
  });

  it("el detalle manda grupo, parámetros y paginación y devuelve la respuesta sin envolver", async () => {
    const respuesta = {
      resumen: {},
      pedidos: { filas: [], total: 0 },
      porProducto: [],
      porEstado: [],
    };
    mockGet.mockResolvedValue({ data: respuesta });
    const consulta = {
      ...CONSULTA,
      grupo: "ventas_dia",
      grupo_params: '{"dia":"2026-10-12"}',
      pagina: 2,
      tamano_pagina: 100,
      buscar: "ana",
    };
    await expect(detalleRealSource.fetch(consulta as never, CONTEXTO)).resolves.toBe(respuesta);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/detalle", {
      params: consulta,
    });
  });

  it("un error del backend (403, 400) llega al bloque tal cual para que muestre «Reintentar»", async () => {
    mockGet.mockRejectedValue(new Error("Request failed with status code 403"));
    await expect(resumenRealSource.fetch(CONSULTA as never, CONTEXTO)).rejects.toThrow("403");
  });
});
