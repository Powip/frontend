import axiosAuth from "@/lib/axiosAuth";
import { detalleFinanzasRealSource } from "../../detalle/sources/detalle.source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import type { CajaPanel } from "../models/caja.model";
import type { CobranzaPanel } from "../models/cobranza.model";
import type { ResultadoPanel } from "../models/resultado.model";
import {
  finanzasCajaRealSource,
  finanzasCobranzaRealSource,
  finanzasResultadoRealSource,
} from "../sources/finanzas.source";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockGet = jest.mocked(axiosAuth.get);
const CONSULTA: PanelQuery = {
  desde: "2026-10-01",
  hasta: "2026-10-28",
  anterior_desde: "2026-09-03",
  anterior_hasta: "2026-09-30",
  zona_horaria: "America/Lima",
  tienda: "tienda-1",
};
const CONTEXTO = {} as never;
const SOBRE = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };

beforeEach(() => {
  mockGet.mockReset();
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.example.com";
});

describe("Finanzas: fuentes reales de GET /panel/finanzas", () => {
  it("resultado pide reloj=pedido con los filtros tal cual y devuelve el sobre tipado", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    expect(finanzasResultadoRealSource).toMatchObject({
      contractId: "finanzas-resultado",
      kind: "real",
    });
    const respuesta: PanelEnvelope<ResultadoPanel> = await finanzasResultadoRealSource.fetch(
      CONSULTA,
      CONTEXTO,
    );
    expect(respuesta).toBe(SOBRE);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/finanzas", {
      params: { ...CONSULTA, reloj: "pedido" },
    });
  });

  it("caja pide reloj=caja", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    expect(finanzasCajaRealSource).toMatchObject({ contractId: "finanzas-caja", kind: "real" });
    const respuesta: PanelEnvelope<CajaPanel> = await finanzasCajaRealSource.fetch(
      CONSULTA,
      CONTEXTO,
    );
    expect(respuesta).toBe(SOBRE);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/finanzas", {
      params: { ...CONSULTA, reloj: "caja" },
    });
  });

  it("cobranza pide reloj=cobranza", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    expect(finanzasCobranzaRealSource).toMatchObject({
      contractId: "finanzas-cobranza",
      kind: "real",
    });
    const respuesta: PanelEnvelope<CobranzaPanel> = await finanzasCobranzaRealSource.fetch(
      CONSULTA,
      CONTEXTO,
    );
    expect(respuesta).toBe(SOBRE);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/finanzas", {
      params: { ...CONSULTA, reloj: "cobranza" },
    });
  });

  it("cada reloj es una petición propia: si una falla las otras siguen", async () => {
    mockGet.mockRejectedValueOnce(new Error("503"));
    mockGet.mockResolvedValueOnce({ data: SOBRE });
    await expect(finanzasCajaRealSource.fetch(CONSULTA, CONTEXTO)).rejects.toThrow("503");
    await expect(finanzasCobranzaRealSource.fetch(CONSULTA, CONTEXTO)).resolves.toBe(SOBRE);
  });

  it("un reloj no deja sus parámetros en el siguiente (no muta la consulta)", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    await finanzasCajaRealSource.fetch(CONSULTA, CONTEXTO);
    expect(CONSULTA).not.toHaveProperty("reloj");
  });
});

describe("Finanzas: el detalle", () => {
  it("lo sirve la fuente real de la pestaña Finanzas y pide GET /panel/detalle tal cual", async () => {
    mockGet.mockResolvedValue({ data: { resumen: {} } });
    expect(detalleFinanzasRealSource).toMatchObject({
      contractId: "detalle",
      kind: "real",
      pestanas: ["finanzas"],
    });
    expect(detalleFinanzasRealSource.subpestanas).toBeUndefined();
    const consulta = {
      ...CONSULTA,
      grupo: "movimientos_caja" as const,
      grupo_params: JSON.stringify({ concepto: "fletes" }),
      pagina: 1,
      tamano_pagina: 100,
    };
    await detalleFinanzasRealSource.fetch(consulta, CONTEXTO);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/detalle", {
      params: consulta,
    });
  });
});
