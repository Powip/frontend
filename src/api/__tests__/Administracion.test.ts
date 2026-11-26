import axiosAuth from "@/lib/axiosAuth";
import { getEnTransitoAdministracion, getResultadosAdministracion } from "../Administracion";

// La empresa sale del token: las dos lecturas van con la sesión (axiosAuth), nunca con axios pelado.
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/lib/api", () => ({ API: { ventas: "http://ventas" } }));

const authGet = jest.mocked(axiosAuth.get);
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
