/**
 * Tests: una toma de inventario (FEAT-24 H5).
 *
 * 1. Conteo ciego en curso: no se muestra ni se calcula el esperado ni la diferencia (aunque llegue).
 * 2. Escanear suma 1 con el código tal cual; cargar a mano reemplaza lo contado.
 * 3. Por validar: se ve todo, se decide por línea y «Validar y aplicar» manda las decisiones y aplica; con
 *    el periodo cerrado (423) lo explica y el reintento usa la MISMA Idempotency-Key.
 * 4. «Pendiente de investigar» pide responsable y fecha.
 * 5. Almacén cuenta y cierra, pero no valida, no aplica ni anula.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addCountEntries, applyCount, closeCount, getCount, setCountDecisions } from "@/services/warehouseOpsService";
import CountSheet from "../counts/CountSheet";
import { apiError, count, countLine } from "./fixtures";

const mockUser = { id: "u-1", role: "OPERACIONES", email: "ops@empresa.pe", permissions: [] as string[] };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: mockUser } }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/barcodeScanner", () => ({ ...jest.requireActual("@/lib/barcodeScanner"), scanFeedback: jest.fn() }));
jest.mock("@/services/warehouseOpsService", () => ({
  getCount: jest.fn(),
  addCountEntries: jest.fn(),
  closeCount: jest.fn(),
  setCountDecisions: jest.fn(),
  recountLines: jest.fn(),
  applyCount: jest.fn(),
  cancelCount: jest.fn(),
}));

const blindOpen = count({
  // La fachada omite el esperado; si igual llegara, la pantalla no lo muestra.
  lines: [countLine("l-1", "Polo", { expected: 7 }), countLine("l-2", "Gorra", { counted: 3 })],
});

const toValidate = count({
  status: "por_validar",
  closedAt: "2026-11-17T18:00:00Z",
  lines: [
    countLine("l-1", "Polo", { systemInitial: 10, movementsDuring: -2, expected: 8, counted: 5, difference: -3, differenceValue: -90, withinTolerance: false }),
    countLine("l-2", "Gorra", { systemInitial: 3, movementsDuring: 0, expected: 3, counted: 3, difference: 0, withinTolerance: true }),
  ],
});

// FEAT-24 H10: cada operación que mueve stock refresca el badge de Alertas.
const invalidate = jest.spyOn(QueryClient.prototype, "invalidateQueries");
const alertsRefreshed = () => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inventory-alerts"] });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CountSheet companyId="c-1" countId="ct-1" warehouseName="Central" courierWarehouse={false} onChanged={jest.fn()} onClose={jest.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.role = "OPERACIONES";
});

describe("Toma de inventario", () => {
  it("conteo ciego en curso: sin esperado ni diferencias", async () => {
    jest.mocked(getCount).mockResolvedValue(blindOpen);
    setup();
    expect(await screen.findByText("Conteo ciego: el stock del sistema y las diferencias se ven al cerrar el conteo.")).toBeInTheDocument();
    const table = screen.getByRole("table");
    for (const header of ["Foto al iniciar", "Mov. durante", "Esperado", "Diferencia", "Valor"]) expect(within(table).queryByText(header)).not.toBeInTheDocument();
    expect(within(table).queryByText("7")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Contado: Gorra")).toHaveValue("3");
  });

  it("escanear suma 1 con el código tal cual y a mano reemplaza lo contado", async () => {
    const user = userEvent.setup();
    jest.mocked(getCount).mockResolvedValue(blindOpen);
    jest.mocked(addCountEntries)
      .mockResolvedValueOnce({ countId: "ct-1", status: "en_curso", applied: [{ lineId: "l-1", variantId: "v-l-1", counted: 1 }], unresolved: [], duplicate: false })
      .mockResolvedValueOnce({ countId: "ct-1", status: "en_curso", applied: [{ lineId: "l-2", variantId: "v-l-2", counted: 5 }], unresolved: [], duplicate: false });
    setup();
    await user.type(await screen.findByLabelText("Escanear (cada escaneo suma 1 al contado)"), "7750001{Enter}");
    await waitFor(() => expect(screen.getByLabelText("Contado: Polo")).toHaveValue("1"));
    expect(jest.mocked(addCountEntries).mock.calls[0]).toEqual(["ct-1", { mode: "add", entries: [{ code: "7750001", quantity: 1 }], operationId: expect.any(String) }]);
    expect(screen.getByRole("status")).toHaveTextContent("+1: Polo (contado 1)");

    const gorra = screen.getByLabelText("Contado: Gorra");
    await user.clear(gorra);
    await user.type(gorra, "5{Enter}");
    await waitFor(() => expect(addCountEntries).toHaveBeenCalledTimes(2));
    expect(jest.mocked(addCountEntries).mock.calls[1]).toEqual(["ct-1", { mode: "set", entries: [{ variantId: "v-l-2", quantity: 5 }], operationId: expect.any(String) }]);
    await waitFor(() => expect(screen.getByLabelText("Contado: Gorra")).toHaveValue("5"));
  });

  it("un escaneo que el servidor no reconoce se avisa", async () => {
    const user = userEvent.setup();
    jest.mocked(getCount).mockResolvedValue(blindOpen);
    jest.mocked(addCountEntries).mockResolvedValue({
      countId: "ct-1",
      status: "en_curso",
      applied: [],
      unresolved: [{ code: "999", variantId: null, quantity: 1, reason: "no_encontrado" }],
      duplicate: false,
    });
    setup();
    await user.type(await screen.findByLabelText("Escanear (cada escaneo suma 1 al contado)"), "999{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("El código 999");
  });

  it("por validar: decide, aplica y con el periodo cerrado reintenta con la misma clave", async () => {
    const user = userEvent.setup();
    jest.mocked(getCount).mockResolvedValue(toValidate);
    jest.mocked(setCountDecisions).mockResolvedValue(toValidate);
    jest.mocked(applyCount)
      .mockRejectedValueOnce(apiError(423, "El periodo 2026-10 está cerrado.", { code: "PERIODO_CERRADO", period: "2026-10" }))
      .mockResolvedValueOnce({ duplicate: false, count: { ...toValidate, status: "aplicado" } });
    setup();
    const polo = await screen.findByTestId("count-line-l-1");
    expect(within(polo).getByText("8")).toBeInTheDocument();
    expect(within(polo).getByText("-3")).toBeInTheDocument();
    expect(within(screen.getByTestId("count-line-l-2")).getByText("Cuadra")).toBeInTheDocument();
    const decision = within(polo).getByLabelText("Decisión: Polo");
    expect(within(decision).queryByRole("option", { name: "Ingresar sobrante" })).not.toBeInTheDocument();
    await user.selectOptions(decision, "perdida");
    await user.click(screen.getByRole("button", { name: "Validar y aplicar" }));
    expect(await screen.findByText(/reabrir el periodo en Inventario › Cierre mensual/)).toBeInTheDocument();
    expect(setCountDecisions).toHaveBeenCalledWith("ct-1", [{ lineId: "l-1", decision: "perdida" }]);
    await user.click(screen.getByRole("button", { name: "Validar y aplicar" }));
    await waitFor(() => expect(applyCount).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(applyCount).mock.calls;
    expect(second[1].operationId).toBe(first[1].operationId);
    await waitFor(alertsRefreshed);
  });

  it("«Pendiente de investigar» pide responsable y fecha antes de aplicar", async () => {
    const user = userEvent.setup();
    jest.mocked(getCount).mockResolvedValue(toValidate);
    setup();
    const polo = await screen.findByTestId("count-line-l-1");
    await user.selectOptions(within(polo).getByLabelText("Decisión: Polo"), "pendiente");
    await user.click(screen.getByRole("button", { name: "Validar y aplicar" }));
    expect(await screen.findByText("Polo: Pendiente de investigar pide responsable y fecha límite.")).toBeInTheDocument();
    expect(applyCount).not.toHaveBeenCalled();
  });

  it("Almacén cuenta y cierra, pero no valida, no aplica ni anula", async () => {
    const user = userEvent.setup();
    mockUser.role = "ALMACEN";
    jest.mocked(getCount).mockResolvedValueOnce(blindOpen).mockResolvedValue(toValidate);
    jest.mocked(closeCount).mockResolvedValue(toValidate);
    setup();
    await user.click(await screen.findByRole("button", { name: "Cerrar y enviar a validación" }));
    await waitFor(() => expect(closeCount).toHaveBeenCalledWith("ct-1"));
    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
    await screen.findByTestId("count-line-l-1");
    await waitFor(() => expect(screen.getByText("Esperado")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Validar y aplicar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Decisión: Polo")).not.toBeInTheDocument();
  });
});
