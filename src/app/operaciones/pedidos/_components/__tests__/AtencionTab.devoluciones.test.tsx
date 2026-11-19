import { render, screen } from "@testing-library/react";
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
    status: "EN_ENVIO" as OrderStatus,
    paymentMethod: "EFECTIVO",
    deliveryType: "DOMICILIO",
    salesRegion: "LIMA",
    district: "Miraflores",
    address: "Av. Test 123",
    advancePayment: 150,
    pendingPayment: 0,
    notes: "",
    guideNumber: "G-1",
    hasPendingApprovalPayments: false,
    sellerName: "Vendedor 1",
    createdAt: nowIso,
    updatedAt: nowIso,
    callbackAt: null,
    items: [],
    shalomStatus: "DEVUELTO",
    ...overrides,
  } as Sale;
}

describe("Devoluciones de Operaciones (FEAT-24 H2-F)", () => {
  it("ofrece «Devuelto por courier» en lugar de «Reingresar a stock» y «Marcar merma»", async () => {
    const user = userEvent.setup();
    const onCourierReturn = jest.fn();
    const actions = { onCourierReturn, onWhatsApp: jest.fn(), onDeliveryReschedule: jest.fn() } as unknown as PedidosActions;
    render(
      <OrderDetailModalProvider>
        <AtencionTab sales={[makeSale()]} actions={actions} initialQf="fallidos" />
      </OrderDetailModalProvider>,
    );

    expect(screen.queryByRole("button", { name: /Reingresar a stock/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar merma/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Devuelto por courier/ }));
    expect(onCourierReturn).toHaveBeenCalledWith(expect.objectContaining({ id: "sale-1" }));
  });
});
