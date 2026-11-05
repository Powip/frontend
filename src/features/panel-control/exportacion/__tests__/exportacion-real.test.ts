import axiosAuth from "@/lib/axiosAuth";
import { mensajeDeError } from "../../shared/api/panel-errors";
import type { PanelQuery } from "../../shared/models/panel-query.model";
import { descargarLibro, nombreDeDescarga } from "../api/exportacion.api";
import { compartirReporteRealSource } from "../sources/compartir.source";
import { exportacionLibroRealSource } from "../sources/exportacion.source";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockGet = jest.mocked(axiosAuth.get);
const CONSULTA: PanelQuery = {
  desde: "2026-10-01",
  hasta: "2026-10-14",
  anterior_desde: "2026-09-17",
  anterior_hasta: "2026-09-30",
  zona_horaria: "America/Lima",
  tienda: "tienda-1",
};
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

beforeEach(() => mockGet.mockReset());

function errorHttp(status: number, cuerpo: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {
      status,
      data: new Blob([JSON.stringify(cuerpo)], { type: "application/json" }),
    },
  });
}

describe("descargarLibro", () => {
  it("pide GET /panel/export.xlsx como blob, sin 'formato' en los params", async () => {
    mockGet.mockResolvedValue({
      data: new Blob(["x"], { type: XLSX_TYPE }),
      headers: {
        "content-disposition": 'attachment; filename="powip_panel_2026-10-01_2026-10-14.xlsx"',
      },
    });
    await descargarLibro({ ...CONSULTA, formato: "xlsx" });
    const [url, config] = mockGet.mock.calls[0];
    expect(String(url)).toMatch(/\/panel\/export\.xlsx$/);
    expect(config).toMatchObject({ responseType: "blob" });
    expect((config as { params: object }).params).toEqual(CONSULTA);
  });

  it("usa el nombre del Content-Disposition", async () => {
    mockGet.mockResolvedValue({
      data: new Blob(["x"], { type: XLSX_TYPE }),
      headers: {
        "content-disposition": 'attachment; filename="powip_panel_2026-10-01_2026-10-14.xlsx"',
      },
    });
    const { archivo, nombreArchivo } = await descargarLibro({ ...CONSULTA, formato: "xlsx" });
    expect(nombreArchivo).toBe("powip_panel_2026-10-01_2026-10-14.xlsx");
    expect(archivo).toBeInstanceOf(Blob);
  });

  it("si el header no llega usa el patrón powip_panel_AAAA-MM-DD_AAAA-MM-DD.xlsx", async () => {
    mockGet.mockResolvedValue({ data: new Blob(["x"]), headers: {} });
    const { nombreArchivo } = await descargarLibro({ ...CONSULTA, formato: "xlsx" });
    expect(nombreArchivo).toBe("powip_panel_2026-10-01_2026-10-14.xlsx");
  });

  it("nombreDeDescarga acepta filename sin comillas y en minúsculas/mayúsculas", () => {
    expect(nombreDeDescarga("attachment; filename=a.xlsx", "b.xlsx")).toBe("a.xlsx");
    expect(nombreDeDescarga(undefined, "b.xlsx")).toBe("b.xlsx");
    expect(nombreDeDescarga("inline", "b.xlsx")).toBe("b.xlsx");
  });

  it("un 403 llega como Blob JSON: se lee y mensajeDeError dice que no hay permiso", async () => {
    mockGet.mockRejectedValue(errorHttp(403, { message: "Forbidden resource" }));
    const error = await descargarLibro({ ...CONSULTA, formato: "xlsx" }).catch((e) => e);
    expect(mensajeDeError(error)).toBe("Tu rol no tiene acceso a esta información.");
  });

  it("un 400 llega como Blob JSON: se muestra su mensaje", async () => {
    mockGet.mockRejectedValue(errorHttp(400, { message: "El rango no puede superar 180 días" }));
    const error = await descargarLibro({ ...CONSULTA, formato: "xlsx" }).catch((e) => e);
    expect(mensajeDeError(error)).toBe("El rango no puede superar 180 días");
  });

  it("un 503 se muestra como servicio no disponible", async () => {
    mockGet.mockRejectedValue(errorHttp(503, { message: "x" }));
    const error = await descargarLibro({ ...CONSULTA, formato: "xlsx" }).catch((e) => e);
    expect(mensajeDeError(error)).toMatch(/no está disponible/);
  });

  it("un error con cuerpo que no es JSON no rompe: conserva el error original", async () => {
    mockGet.mockRejectedValue(
      Object.assign(new Error("boom"), { response: { status: 500, data: new Blob(["<html>"]) } }),
    );
    const error = await descargarLibro({ ...CONSULTA, formato: "xlsx" }).catch((e) => e);
    expect(mensajeDeError(error)).toBe("boom");
  });
});

describe("fuentes reales", () => {
  it("exportacion-libro es real y descarga con la consulta", async () => {
    mockGet.mockResolvedValue({ data: new Blob(["x"]), headers: {} });
    expect(exportacionLibroRealSource.kind).toBe("real");
    const r = await exportacionLibroRealSource.fetch({ ...CONSULTA, formato: "xlsx" }, {} as never);
    expect(r.nombreArchivo).toBe("powip_panel_2026-10-01_2026-10-14.xlsx");
  });

  it("compartir-reporte es real: GET /panel/compartir y devuelve el objeto plano", async () => {
    const cuerpo = { periodo: "x", texto: "hola" };
    mockGet.mockResolvedValue({ data: cuerpo });
    expect(compartirReporteRealSource.kind).toBe("real");
    const r = await compartirReporteRealSource.fetch(CONSULTA, {} as never);
    expect(String(mockGet.mock.calls[0][0])).toMatch(/\/panel\/compartir$/);
    expect(r).toBe(cuerpo);
  });
});
