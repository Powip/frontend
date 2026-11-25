import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderDetailModalProvider } from "@/components/orders/OrderDetailModal";
import type { OrderStatus } from "@/interfaces/IOrder";
import { AtencionTab } from "../AtencionTab";
import type { PedidosActions, Sale } from "../types";

jest.mock("@/components/modals/CustomerServiceModal", () => ({ __esModule: true, default: () => null }));

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const nowIso = new Date().toISOString();
  return {
    id: "sale-1",
    customerId: "cust-1",
    orderNumber: "ORD-0001",
    clientName: "Juan Pérez",
    phoneNumber: "999111222",
    date: "01/01/2026",
    total: 150,
    status: "DESPACHADO" as OrderStatus,
    paymentMethod: "EFECTIVO",
    deliveryType: "DOMICILIO",
    salesRegion: "LIMA",
    district: "Miraflores",
    address: "Av. Test 123",
    advancePayment: 150,
    pendingPayment: 0,
    notes: "",
    guideNumber: "GE-1",
    courier: "Shalom",
    hasPendingApprovalPayments: false,
    sellerName: "Vendedor 1",
    createdAt: nowIso,
    updatedAt: nowIso,
    callbackAt: null,
    items: [],
    ...overrides,
  } as Sale;
}

const actions = {
  onCourierReturn: jest.fn(),
  onWhatsApp: jest.fn(),
  onDeliveryReschedule: jest.fn(),
  salesChannels: [],
} as unknown as PedidosActions;

const registro = makeSale({
  id: "sale-reg",
  orderNumber: "ORD-REG",
  shalomStatus: "FALLIDO",
  shalomError: "Confirma y prepara el pedido antes de despacharlo.",
});
const devuelto = makeSale({
  id: "sale-dev",
  orderNumber: "ORD-DEV",
  shalomStatus: "DEVUELTO",
  shalomError: "Cliente no recoge en agencia",
});

function renderTab(sales: Sale[], initialQf?: string) {
  return render(
    <OrderDetailModalProvider>
      <AtencionTab sales={sales} actions={actions} initialQf={initialQf} />
    </OrderDetailModalProvider>,
  );
}

describe("Necesita Atención: error al registrar en Shalom", () => {
  it("separa los registros fallidos en Shalom de las entregas fallidas", () => {
    renderTab([registro, devuelto]);
    expect(screen.getByRole("button", { name: "Error al registrar en Shalom (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Devoluciones (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trabados (0)" })).toBeInTheDocument();
  });

  it("muestra el mensaje real de Shalom y no «Entrega fallida / Otro motivo»", async () => {
    const user = userEvent.setup();
    renderTab([registro, devuelto]);
    await user.click(screen.getByRole("button", { name: "Error al registrar en Shalom (1)" }));

    const badge = screen.getByTestId("shalom-registration-error");
    expect(within(badge).getByText("Error al registrar en Shalom")).toBeInTheDocument();
    expect(
      within(badge).getByText("Confirma y prepara el pedido antes de despacharlo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Entrega fallida")).not.toBeInTheDocument();
    expect(screen.queryByText("Otro motivo")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-REG")).toBeInTheDocument();
    expect(screen.queryByText("ORD-DEV")).not.toBeInTheDocument();
  });

  it("la tarjeta «Errores de agencia» del Tablero abre esta sub-vista", () => {
    renderTab([registro, devuelto], "errores-agencia");
    expect(screen.getByTestId("shalom-registration-info")).toBeInTheDocument();
  });

  it("las devoluciones siguen diciendo «Entrega fallida»", async () => {
    const user = userEvent.setup();
    renderTab([registro, devuelto]);
    await user.click(screen.getByRole("button", { name: "Devoluciones (1)" }));
    expect(screen.getByText("Entrega fallida")).toBeInTheDocument();
    expect(screen.queryByTestId("shalom-registration-error")).not.toBeInTheDocument();
  });
});
