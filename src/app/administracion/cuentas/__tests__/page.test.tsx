import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import CuentasPage from "../page";

const mockTransito = jest.fn();
const mockSettlements = jest.fn();

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "u1" }, company: { id: "c1" } } }),
}));
jest.mock("../../_lib/useResultados", () => ({
  DIAS_EN_TRANSITO: 90,
  useAdminContexto: () => ({ companyId: "c1", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
  usePedidosEnTransito: () => mockTransito(),
}));
jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  getCourierSettlements: (...args: unknown[]) => mockSettlements(...args),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const PEDIDOS = [
  { id: "1", courier: "Shalom", grandTotal: 100, payments: [], status: "EN_ENVIO" },
  { id: "2", courier: " SHALOM ", grandTotal: 50, payments: [{ status: "PAID", amount: 20 }], status: "DESPACHADO" },
  { id: "3", courier: "Olva", grandTotal: 80, payments: [{ status: "PAID", amount: 80 }], status: "ASIGNADO_A_GUIA" },
  { id: "4", courier: null, grandTotal: 40, payments: [], status: "EN_ENVIO" },
];

const coleccion = (courierName: string, currency: string, remainingAmount: number, reservedAmount = 0) => ({
  id: `${courierName}-${currency}`,
  companyId: "c1",
  courierId: courierName,
  courierName,
  currency,
  remainingAmount,
  reservedAmount,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CuentasPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockTransito.mockReturnValue({
    cargando: false,
    error: null,
    pedidos: PEDIDOS,
    saldo: 170,
    desde: "2026-08-29",
    hasta: "2026-11-26",
  });
  mockSettlements.mockResolvedValue({
    collections: [coleccion("Shalom", "PEN", 300, 50), coleccion("Shalom", "USD", 10)],
  });
});

describe("Cuentas por cobrar y pagar", () => {
  it("saldo en calle de todos los pedidos en tránsito, agrupado por courier", async () => {
    renderPage();
    expect(screen.getByRole("region", { name: "En calle" })).toHaveTextContent("S/ 170");
    expect(screen.getByRole("region", { name: "En calle" })).toHaveTextContent("4 pedidos en tránsito");

    const tabla = screen.getByRole("table", { name: /Saldo por cobrar de los pedidos en tránsito/ });
    const shalom = within(tabla).getByText("Shalom").closest("tr") as HTMLElement;
    expect(shalom).toHaveTextContent("2");
    expect(shalom).toHaveTextContent("S/ 130");
    expect(within(tabla).getByText("Sin courier").closest("tr")).toHaveTextContent("S/ 40");
    expect(within(tabla).getByText("Olva").closest("tr")).toHaveTextContent("S/ 0");

    // Cobros confirmados del courier por liquidar (solo PEN en el KPI).
    expect(await screen.findByText("PEN 300.00")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Courier por liquidar" })).toHaveTextContent("S/ 300");
    expect(screen.getByRole("region", { name: "Courier por liquidar" })).toHaveTextContent("además en USD");
  });

  it("sin «vencidas» ni «próximas»: el registro manual va a por pagar y al historial", async () => {
    renderPage();
    await screen.findByText("PEN 300.00");
    expect(screen.queryByText(/vencid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/próxima/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Agregar cuenta/ }));
    fireEvent.change(screen.getByLabelText("Concepto"), { target: { value: "Proveedor de cajas" } });
    fireEvent.change(screen.getByLabelText("Monto (S/)"), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Vencimiento o nota"), { target: { value: "a fin de mes" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("region", { name: "Por pagar" })).toHaveTextContent("S/ 250");
    const porPagar = screen.getByRole("region", { name: "Por pagar (registro manual)" });
    expect(within(porPagar).getByText("Proveedor de cajas")).toBeInTheDocument();
    expect(within(porPagar).getByText("a fin de mes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marcar Proveedor de cajas como pagada" }));
    expect(screen.getByRole("region", { name: "Por pagar" })).toHaveTextContent("S/ 0");

    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    const historial = screen.getByRole("table", { name: /Historial de cuentas/ });
    expect(within(historial).getByText("Proveedor de cajas")).toBeInTheDocument();
    expect(within(historial).getByText("Pagado")).toBeInTheDocument();
    expect(within(historial).getByText("noviembre 2026")).toBeInTheDocument();
  });

  it("no revienta sin datos ni si falla la consulta del courier", async () => {
    mockTransito.mockReturnValue({ cargando: false, error: null, pedidos: [], saldo: 0, desde: "", hasta: "" });
    mockSettlements.mockRejectedValue(new Error("caído"));
    renderPage();
    expect(screen.getByText("No hay pedidos en tránsito")).toBeInTheDocument();
    expect(await screen.findByText("No se pudieron consultar los saldos del courier.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Courier por liquidar" })).toHaveTextContent("—");
  });
});
