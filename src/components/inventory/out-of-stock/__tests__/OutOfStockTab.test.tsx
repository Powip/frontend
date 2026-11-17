import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import OutOfStockTab from "../OutOfStockTab";
import { getStockTray, handleOutOfStockOrder, type StockTrayRow } from "@/services/orderStockService";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/orderStockService", () => ({
  getStockTray: jest.fn(),
  handleOutOfStockOrder: jest.fn(),
}));

const FULL = { customer: true, operations: true, sinReserva: true, warehouse: true };
const OPS_ONLY = { customer: false, operations: true, sinReserva: true, warehouse: false };

function row(overrides: Partial<StockTrayRow> = {}): StockTrayRow {
  return {
    orderId: "o-1",
    orderNumber: "ORD-100",
    status: "PREPARADO",
    storeId: "s-1",
    inventoryId: "inv-1",
    stockState: "sin_stock",
    outOfStockSince: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    handling: null,
    customerNotifiedAt: null,
    customer: { id: "c-1", fullName: "Ana Pérez", phoneNumber: "+51999888777" },
    grandTotal: 120,
    lines: [{ itemId: "i-1", productName: "Polo negro M", sku: "POL-M", variantId: "v-1", quantity: 2, alternatives: [{ id: "alt" }] }],
    ...overrides,
  };
}

function page(rows: StockTrayRow[]) {
  return { total: rows.length, limit: 50, offset: 0, rows };
}

function renderTab(access = FULL) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OutOfStockTab companyId="c-1" access={access} />
    </QueryClientProvider>,
  );
}

describe("Inventario › Pedidos sin stock (FEAT-24 H2-F)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getStockTray).mockImplementation(async (tray) =>
      tray === "sin-stock" ? page([row()]) : page([row({ orderId: "o-2", orderNumber: "ORD-200", stockState: "sin_reserva", outOfStockSince: null })]),
    );
  });

  it("lista los pedidos sin stock con cliente, producto y días esperando, sin alternativas", async () => {
    renderTab();
    const tableRow = await screen.findByTestId("tray-row-o-1");
    expect(within(tableRow).getByText("ORD-100")).toBeInTheDocument();
    expect(within(tableRow).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(tableRow).getByText("Polo negro M")).toBeInTheDocument();
    expect(within(tableRow).getByText("× 2")).toBeInTheDocument();
    expect(within(tableRow).getByText("3 días")).toBeInTheDocument();
    expect(within(tableRow).queryByText(/alternativ/i)).not.toBeInTheDocument();
    expect(getStockTray).toHaveBeenCalledWith("sin-stock", { limit: 50, offset: 0 });
    expect(screen.getByRole("tab", { name: /Sin stock/ })).toHaveTextContent("1");
  });

  it("«Espera» muestra la plantilla con Copiar y Abrir WhatsApp", async () => {
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    jest.mocked(handleOutOfStockOrder).mockResolvedValue({
      action: "espera",
      template: "Hola Ana, te escribimos por tu pedido ORD-100.",
      phone: "+51999888777",
      whatsappUrl: "https://wa.me/51999888777?text=Hola",
    });
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Espera de ORD-100" }));
    expect(handleOutOfStockOrder).toHaveBeenCalledWith("o-1", "espera");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("wait-template")).toHaveTextContent("Hola Ana, te escribimos por tu pedido ORD-100.");
    expect(within(dialog).getByRole("link", { name: "Abrir WhatsApp" })).toHaveAttribute("href", "https://wa.me/51999888777?text=Hola");
    await user.click(within(dialog).getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith("Hola Ana, te escribimos por tu pedido ORD-100.");
  });

  it("«Anular» pide confirmación y recarga la bandeja", async () => {
    const user = userEvent.setup();
    jest.mocked(handleOutOfStockOrder).mockResolvedValue({ action: "anular", status: "ANULADO" });
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Anular ORD-100" }));
    expect(handleOutOfStockOrder).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Anular pedido" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pedido ORD-100 anulado"));
    expect(handleOutOfStockOrder).toHaveBeenCalledWith("o-1", "anular");
    await waitFor(() => expect(jest.mocked(getStockTray).mock.calls.filter(([tray]) => tray === "sin-stock").length).toBeGreaterThan(1));
  });

  it("«Cambio» lleva a editar el pedido y un 409 muestra el mensaje del servidor", async () => {
    const user = userEvent.setup();
    jest.mocked(handleOutOfStockOrder)
      .mockResolvedValueOnce({ action: "cambio", next: "Editá los productos del pedido." })
      .mockRejectedValueOnce({ response: { status: 409, data: { message: "Esta acción se habilita cuando se active «Stock ↔ pedidos»." } } });
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Cambio de ORD-100" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    const [, options] = jest.mocked(toast.info).mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/registrar-venta?orderId=o-1");
    await user.click(screen.getByRole("button", { name: "Re-reservar ORD-100" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Esta acción se habilita cuando se active «Stock ↔ pedidos»."),
    );
  });

  it("Operaciones solo ve «Sin reserva», sin acciones de Atención al cliente", async () => {
    renderTab(OPS_ONLY);
    expect(await screen.findByTestId("tray-row-o-2")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Sin stock/ })).not.toBeInTheDocument();
    expect(getStockTray).not.toHaveBeenCalledWith("sin-stock", expect.anything());
    expect(screen.queryByRole("button", { name: /Re-reservar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Volver a reservar es de Atención al cliente/)).toBeInTheDocument();
  });

  it("«Sin reserva» permite volver a reservar", async () => {
    const user = userEvent.setup();
    jest.mocked(handleOutOfStockOrder).mockResolvedValue({ action: "re_reservar", stockState: "reserved" });
    renderTab();
    await user.click(await screen.findByRole("tab", { name: /Sin reserva/ }));
    const tableRow = await screen.findByTestId("tray-row-o-2");
    expect(within(tableRow).getByText("—")).toBeInTheDocument();
    expect(within(tableRow).queryByRole("button", { name: /Anular/ })).not.toBeInTheDocument();
    await user.click(within(tableRow).getByRole("button", { name: "Re-reservar ORD-200" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pedido ORD-200 reservado"));
    expect(handleOutOfStockOrder).toHaveBeenCalledWith("o-2", "re_reservar");
  });
});
