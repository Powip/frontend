import axiosAuth from "@/lib/axiosAuth";
import { callCenterRealSource } from "../../../call-center/sources/call-center.source";
import { canalesComparativoRealSource } from "../../../canales/sources/canales-comparativo.source";
import { canalesDetalleRealSource } from "../../../canales/sources/canales-detalle.source";
import { clientesZonasRealSource } from "../../../clientes-zonas/sources/clientes-zonas.source";
import {
  detalleCallCenterRealSource,
  detalleCanalesRealSource,
  detalleClientesRealSource,
  detalleEquipoRealSource,
  detalleMisVentasRealSource,
  detalleProductosRealSource,
  detalleRealSource,
} from "../../../detalle/sources/detalle.source";
import {
  equipoConfirmadorasRealSource,
  equipoVendedorasRealSource,
} from "../../../equipo/sources/equipo.source";
import { estadoPeriodoRealSource } from "../../../estado-periodo/sources/estado-periodo.source";
import { misVentasRealSource } from "../../../mis-ventas/sources/mis-ventas.source";
import { productosRealSource } from "../../../productos/sources/productos.source";
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

  it("el comparativo de canales manda la vista elegida junto con los filtros", async () => {
    const sobre = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };
    mockGet.mockResolvedValue({ data: sobre });
    const consulta = { ...CONSULTA, vista: "entregas" };
    expect(canalesComparativoRealSource).toMatchObject({
      contractId: "canales-comparativo",
      kind: "real",
    });
    await expect(canalesComparativoRealSource.fetch(consulta as never, CONTEXTO)).resolves.toBe(
      sobre,
    );
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/canales", {
      params: consulta,
    });
  });

  it("el detalle de un canal lleva el id en la ruta, codificado, y no entre los parámetros", async () => {
    const sobre = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };
    mockGet.mockResolvedValue({ data: sobre });
    expect(canalesDetalleRealSource).toMatchObject({ contractId: "canales-detalle", kind: "real" });
    await expect(
      canalesDetalleRealSource.fetch(
        { ...CONSULTA, canal_id: "txt:tiktok live" } as never,
        CONTEXTO,
      ),
    ).resolves.toBe(sobre);
    expect(mockGet).toHaveBeenCalledWith(
      "https://ventas.example.com/panel/canales/txt%3Atiktok%20live",
      { params: CONSULTA },
    );
  });

  it("el detalle de pedidos de Canales es el mismo endpoint, solo para esa subpestaña", async () => {
    mockGet.mockResolvedValue({ data: {} });
    expect(detalleCanalesRealSource).toMatchObject({
      contractId: "detalle",
      kind: "real",
      pestanas: ["canales"],
      subpestanas: ["canales"],
    });
    await detalleCanalesRealSource.fetch({ ...CONSULTA, grupo: "ventas" } as never, CONTEXTO);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/detalle", {
      params: { ...CONSULTA, grupo: "ventas" },
    });
  });

  it("productos lee GET /panel/productos con los filtros tal cual", async () => {
    const sobre = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };
    mockGet.mockResolvedValue({ data: sobre });
    expect(productosRealSource).toMatchObject({ contractId: "productos", kind: "real" });
    await expect(productosRealSource.fetch(CONSULTA as never, CONTEXTO)).resolves.toBe(sobre);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/productos", {
      params: CONSULTA,
    });
  });

  it("el detalle de pedidos de Productos es el mismo endpoint, solo para esa subpestaña", async () => {
    mockGet.mockResolvedValue({ data: {} });
    expect(detalleProductosRealSource).toMatchObject({
      contractId: "detalle",
      kind: "real",
      pestanas: ["canales"],
      subpestanas: ["productos"],
    });
    await detalleProductosRealSource.fetch(
      { ...CONSULTA, grupo: "ventas", grupo_params: '{"producto":"var-1"}' } as never,
      CONTEXTO,
    );
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/detalle", {
      params: { ...CONSULTA, grupo: "ventas", grupo_params: '{"producto":"var-1"}' },
    });
  });

  it("clientes lee GET /panel/clientes con los filtros tal cual", async () => {
    const sobre = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };
    mockGet.mockResolvedValue({ data: sobre });
    expect(clientesZonasRealSource).toMatchObject({ contractId: "clientes-zonas", kind: "real" });
    await expect(clientesZonasRealSource.fetch(CONSULTA as never, CONTEXTO)).resolves.toBe(sobre);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/clientes", {
      params: CONSULTA,
    });
  });

  it("el detalle de pedidos de Clientes es el mismo endpoint, solo para esa subpestaña", async () => {
    mockGet.mockResolvedValue({ data: {} });
    expect(detalleClientesRealSource).toMatchObject({
      contractId: "detalle",
      kind: "real",
      pestanas: ["canales"],
      subpestanas: ["clientes"],
    });
    await detalleClientesRealSource.fetch(
      { ...CONSULTA, grupo: "historial_cliente", grupo_params: '{"cliente":"c1"}' } as never,
      CONTEXTO,
    );
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/detalle", {
      params: { ...CONSULTA, grupo: "historial_cliente", grupo_params: '{"cliente":"c1"}' },
    });
  });

  it("call center lee GET /panel/callcenter y su detalle sirve solo a esa pestaña", async () => {
    const sobre = { actual: {}, anterior_misma_antiguedad: null, metas: null, generado_en: "x" };
    mockGet.mockResolvedValue({ data: sobre });
    expect(callCenterRealSource).toMatchObject({ contractId: "callcenter", kind: "real" });
    await expect(callCenterRealSource.fetch(CONSULTA as never, CONTEXTO)).resolves.toBe(sobre);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/callcenter", {
      params: CONSULTA,
    });
    expect(detalleCallCenterRealSource).toMatchObject({
      contractId: "detalle",
      kind: "real",
      pestanas: ["callcenter"],
    });
  });

  it("equipo agrega el tipo a la consulta y su detalle sirve solo a esa pestaña", async () => {
    mockGet.mockResolvedValue({ data: {} });
    await equipoVendedorasRealSource.fetch(
      { ...CONSULTA, agrupar: "zona", upsell: "sin" } as never,
      CONTEXTO,
    );
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/equipo", {
      params: { ...CONSULTA, agrupar: "zona", upsell: "sin", tipo: "vendedoras" },
    });
    await equipoConfirmadorasRealSource.fetch(CONSULTA as never, CONTEXTO);
    expect(mockGet).toHaveBeenLastCalledWith("https://ventas.example.com/panel/equipo", {
      params: { ...CONSULTA, tipo: "confirmadoras" },
    });
    expect(detalleEquipoRealSource).toMatchObject({ kind: "real", pestanas: ["equipo"] });
  });

  it("mis ventas lee GET /panel/mis-ventas y su detalle sirve solo a esa pestaña", async () => {
    mockGet.mockResolvedValue({ data: {} });
    expect(misVentasRealSource).toMatchObject({ contractId: "mis-ventas", kind: "real" });
    await misVentasRealSource.fetch(CONSULTA as never, CONTEXTO);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/mis-ventas", {
      params: CONSULTA,
    });
    expect(detalleMisVentasRealSource).toMatchObject({ kind: "real", pestanas: ["misventas"] });
  });
});
