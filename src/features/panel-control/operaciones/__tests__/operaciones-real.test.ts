import axiosAuth from "@/lib/axiosAuth";
import { detalleOperacionesRealSource } from "../../detalle/sources/detalle.source";
import type { PanelEnvelope } from "../../shared/models/panel-envelope.model";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import type { ColaPanel } from "../models/cola.model";
import type { CouriersPanel } from "../models/couriers.model";
import type { InventarioPanel } from "../models/inventario.model";
import {
  operacionesColaRealSource,
  operacionesCouriersRealSource,
  operacionesInventarioRealSource,
} from "../sources/operaciones.source";

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

describe("Operaciones: fuentes reales de GET /panel/operaciones", () => {
  it("cola pide sub=cola con los filtros tal cual y devuelve el sobre tipado", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    expect(operacionesColaRealSource).toMatchObject({
      contractId: "operaciones-cola",
      kind: "real",
    });
    const respuesta: PanelEnvelope<ColaPanel> = await operacionesColaRealSource.fetch(
      CONSULTA,
      CONTEXTO,
    );
    expect(respuesta).toBe(SOBRE);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/operaciones", {
      params: { ...CONSULTA, sub: "cola" },
    });
  });

  it("couriers pide sub=couriers", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    expect(operacionesCouriersRealSource).toMatchObject({
      contractId: "operaciones-couriers",
      kind: "real",
    });
    const respuesta: PanelEnvelope<CouriersPanel> = await operacionesCouriersRealSource.fetch(
      CONSULTA,
      CONTEXTO,
    );
    expect(respuesta).toBe(SOBRE);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/operaciones", {
      params: { ...CONSULTA, sub: "couriers" },
    });
  });

  it("inventario pide sub=inventario", async () => {
    mockGet.mockResolvedValue({ data: SOBRE });
    expect(operacionesInventarioRealSource).toMatchObject({
      contractId: "operaciones-inventario",
      kind: "real",
    });
    const respuesta: PanelEnvelope<InventarioPanel> = await operacionesInventarioRealSource.fetch(
      CONSULTA,
      CONTEXTO,
    );
    expect(respuesta).toBe(SOBRE);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/operaciones", {
      params: { ...CONSULTA, sub: "inventario" },
    });
  });

  it("cada sub es una petición propia: un fallo del inventario no toca a la cola ni a couriers", async () => {
    mockGet.mockImplementation(async (_url, config) => {
      const params = (config?.params ?? {}) as { sub?: string };
      if (params.sub === "inventario") {
        throw Object.assign(new Error("Request failed with status code 503"), {
          response: { status: 503 },
        });
      }
      return { data: SOBRE };
    });
    await expect(operacionesInventarioRealSource.fetch(CONSULTA, CONTEXTO)).rejects.toThrow("503");
    await expect(operacionesColaRealSource.fetch(CONSULTA, CONTEXTO)).resolves.toBe(SOBRE);
    await expect(operacionesCouriersRealSource.fetch(CONSULTA, CONTEXTO)).resolves.toBe(SOBRE);
  });
});

describe("Operaciones: detalle de pedidos real (GET /panel/detalle)", () => {
  it("sirve solo a la pestaña Operaciones y es real", () => {
    expect(detalleOperacionesRealSource).toMatchObject({
      contractId: "detalle",
      kind: "real",
      pestanas: ["operaciones"],
    });
    expect(detalleOperacionesRealSource.subpestanas).toBeUndefined();
  });

  it("manda grupo, parámetros y paginación sin tocarlos; qué parámetros abre cada botón se prueba en OperacionesDrills.test", async () => {
    const respuesta = {
      resumen: {},
      pedidos: { filas: [], total: 0, pagina: 1, tamanoPagina: 100 },
      porProducto: [],
      porEstado: [],
    };
    mockGet.mockResolvedValue({ data: respuesta });
    const consulta = {
      ...CONSULTA,
      grupo: "cola_operativa" as const,
      grupo_params: JSON.stringify({ estado: "EN_ENVIO", antiguedad: "mas_5d" }),
      pagina: 2,
      tamano_pagina: 100,
      buscar: "ana",
    };
    await expect(detalleOperacionesRealSource.fetch(consulta, CONTEXTO)).resolves.toBe(respuesta);
    expect(mockGet).toHaveBeenCalledWith("https://ventas.example.com/panel/detalle", {
      params: consulta,
    });
  });
});
