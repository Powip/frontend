import axiosAuth from "@/lib/axiosAuth";
import {
  actualizarCapital,
  actualizarCuenta,
  borrarCapital,
  borrarCuenta,
  crearCapital,
  crearCuenta,
  getCapitalAdministracion,
  getComprasAdministracion,
  getCuentasAdministracion,
  getEnTransitoAdministracion,
  getMetasAdministracion,
  getObjetivosAdministracion,
  getResultadosAdministracion,
  guardarMetasAdministracion,
  guardarObjetivoAdministracion,
  importarDatosLocales,
} from "../Administracion";

// La empresa sale del token: todo va con la sesión (axiosAuth), nunca con axios pelado.
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/api", () => ({ API: { ventas: "http://ventas" } }));

const authGet = jest.mocked(axiosAuth.get);
const authPut = jest.mocked(axiosAuth.put);
const authPost = jest.mocked(axiosAuth.post);
const authPatch = jest.mocked(axiosAuth.patch);
const authDelete = jest.mocked(axiosAuth.delete);
beforeEach(() => jest.clearAllMocks());

test("los resultados se piden por rango de días, sin empresa en la URL", async () => {
  authGet.mockResolvedValue({ data: { fecha: "entrega" } });
  const senal = new AbortController().signal;
  await expect(getResultadosAdministracion("2026-11-01", "2026-11-26", senal)).resolves.toEqual({ fecha: "entrega" });
  expect(authGet).toHaveBeenCalledWith("http://ventas/administracion/resultados", {
    params: { fromDate: "2026-11-01", toDate: "2026-11-26" },
    signal: senal,
  });
});

test("en tránsito no lleva parámetros", async () => {
  authGet.mockResolvedValue({ data: { pedidos: 3 } });
  await expect(getEnTransitoAdministracion()).resolves.toEqual({ pedidos: 3 });
  expect(authGet).toHaveBeenCalledWith("http://ventas/administracion/en-transito", { signal: undefined });
});

describe("Fase 3: datos guardados en el servidor", () => {
  test("metas por año: GET con ?anio y PUT con el año en el cuerpo", async () => {
    authGet.mockResolvedValue({ data: { anio: 2026, ventasAnual: 1 } });
    await expect(getMetasAdministracion(2026)).resolves.toEqual({ anio: 2026, ventasAnual: 1 });
    expect(authGet).toHaveBeenCalledWith("http://ventas/administracion/metas", { params: { anio: 2026 }, signal: undefined });
    authPut.mockResolvedValue({ data: { anio: 2026 } });
    await guardarMetasAdministracion({ anio: 2026, ventasAnual: 100, profitAnual: null, margenObjetivoPct: null });
    expect(authPut).toHaveBeenCalledWith("http://ventas/administracion/metas", {
      anio: 2026,
      ventasAnual: 100,
      profitAnual: null,
      margenObjetivoPct: null,
    });
  });

  test("objetivos: el canal va en la URL, codificado", async () => {
    authGet.mockResolvedValue({ data: { objetivos: {} } });
    await getObjetivosAdministracion();
    expect(authGet).toHaveBeenCalledWith("http://ventas/administracion/objetivos", { signal: undefined });
    authPut.mockResolvedValue({ data: { objetivos: { TIKTOK_LIVE: 5 } } });
    await expect(guardarObjetivoAdministracion("TIKTOK_LIVE", 5)).resolves.toEqual({ objetivos: { TIKTOK_LIVE: 5 } });
    expect(authPut).toHaveBeenCalledWith("http://ventas/administracion/objetivos/TIKTOK_LIVE", { ventasDia: 5 });
  });

  test("capital y cuentas: CRUD por id", async () => {
    authGet.mockResolvedValue({ data: { entradas: [] } });
    await getCapitalAdministracion();
    expect(authGet).toHaveBeenCalledWith("http://ventas/administracion/capital", { signal: undefined });
    authPost.mockResolvedValue({ data: { id: "c1" } });
    await crearCapital({ tipo: "capital_propio", monto: 10 });
    expect(authPost).toHaveBeenCalledWith("http://ventas/administracion/capital", { tipo: "capital_propio", monto: 10 });
    authPatch.mockResolvedValue({ data: { id: "c1" } });
    await actualizarCapital("c1", { cuotasPagadas: 2 });
    expect(authPatch).toHaveBeenCalledWith("http://ventas/administracion/capital/c1", { cuotasPagadas: 2 });
    authDelete.mockResolvedValue({ data: { id: "c1" } });
    await borrarCapital("c1");
    expect(authDelete).toHaveBeenCalledWith("http://ventas/administracion/capital/c1");

    authGet.mockResolvedValue({ data: { cuentas: [] } });
    await getCuentasAdministracion();
    expect(authGet).toHaveBeenLastCalledWith("http://ventas/administracion/cuentas", { signal: undefined });
    await crearCuenta({ lado: "pagar", concepto: "x", monto: 1 });
    expect(authPost).toHaveBeenLastCalledWith("http://ventas/administracion/cuentas", { lado: "pagar", concepto: "x", monto: 1 });
    await actualizarCuenta("k1", { saldadaEn: "2026-11-27" });
    expect(authPatch).toHaveBeenLastCalledWith("http://ventas/administracion/cuentas/k1", { saldadaEn: "2026-11-27" });
    await borrarCuenta("k1");
    expect(authDelete).toHaveBeenLastCalledWith("http://ventas/administracion/cuentas/k1");
  });

  test("importar y compras", async () => {
    authPost.mockResolvedValue({ data: { importado: { metas: 1 }, omitido: [] } });
    await importarDatosLocales({ metas: [{ anio: 2026, ventasAnual: 1, profitAnual: null, margenObjetivoPct: null }] });
    expect(authPost).toHaveBeenLastCalledWith("http://ventas/administracion/importar-local", {
      metas: [{ anio: 2026, ventasAnual: 1, profitAnual: null, margenObjetivoPct: null }],
    });
    authGet.mockResolvedValue({ data: { pagadas: { monto: 5 } } });
    await getComprasAdministracion("2026-11-01", "2026-11-30");
    expect(authGet).toHaveBeenLastCalledWith("http://ventas/administracion/compras", {
      params: { fromDate: "2026-11-01", toDate: "2026-11-30" },
      signal: undefined,
    });
  });
});
