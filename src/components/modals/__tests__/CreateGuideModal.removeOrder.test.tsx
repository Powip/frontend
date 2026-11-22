/**
 * Tests: «Nueva guía» permite quitar un pedido de la guía en armado.
 *
 * 1. Con varios pedidos, cada uno tiene su botón «Quitar» y avisa al padre con el id.
 * 2. Con un solo pedido no se ofrece (para eso está Cancelar).
 * 3. Sin `onRemoveOrder` (pantallas que no lo usan) el botón no aparece.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listWarehouses } from "@/services/warehousesService";
import { WAREHOUSES } from "@/components/warehouse-ops/__tests__/fixtures";
import CreateGuideModal from "../CreateGuideModal";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "company", stores: [{ id: "web" }] }, accessToken: "token" },
    hasPermission: () => true,
  }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/courierService", () => ({ fetchCouriers: jest.fn().mockResolvedValue([{ id: "courier-one", name: "Courier One" }]) }));
jest.mock("@/services/orderStockService", () => ({ changeReservationWarehouse: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const order = (n: number) => ({
  id: `o-${n}`,
  storeId: "web",
  inventoryId: "w-1",
  orderNumber: `ORD-100${n}`,
  clientName: `Cliente ${n}`,
  address: "Dirección",
  district: "Miraflores",
  total: 50,
  pendingPayment: 0,
  zone: "LIMA_SUR",
  status: "PREPARADO",
  stockState: "reserved",
  externalSource: null,
});

function setup(selectedOrders: ReturnType<typeof order>[], onRemoveOrder?: (orderId: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <CreateGuideModal
        open
        onClose={onClose}
        selectedOrders={selectedOrders}
        storeId="web"
        onConfirm={onConfirm}
        onRemoveOrder={onRemoveOrder}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onConfirm, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] });
});

describe("CreateGuideModal: quitar un pedido de la guía", () => {
  it("con varios pedidos, cada uno tiene su botón y avisa con el id del pedido", async () => {
    const onRemoveOrder = jest.fn();
    const { user, onConfirm, onClose } = setup([order(1), order(2), order(3), order(4)], onRemoveOrder);

    expect(await screen.findAllByRole("button", { name: /^Quitar pedido .* de la guía$/ })).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Quitar pedido ORD-1003 de la guía" }));

    expect(onRemoveOrder).toHaveBeenCalledTimes(1);
    expect(onRemoveOrder).toHaveBeenCalledWith("o-3");
    // Quitar un pedido no crea la guía ni cierra el diálogo.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("con un solo pedido no se ofrece quitarlo", async () => {
    setup([order(1)], jest.fn());

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar pedido/ })).not.toBeInTheDocument();
  });

  it("sin onRemoveOrder el botón no aparece", async () => {
    setup([order(1), order(2)]);

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar pedido/ })).not.toBeInTheDocument();
  });
});
