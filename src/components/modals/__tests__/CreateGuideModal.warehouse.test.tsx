/**
 * Tests: «Nueva guía» ofrece cambiar el almacén del pedido (FEAT-24 H12-D3).
 *
 * 1. Con permiso de Operaciones y antes del despacho: cambia el almacén con
 *    PATCH /order-header/:id/stock-warehouse y muestra el nuevo.
 * 2. Pedidos ya despachados (o de Live) no lo ofrecen; sin permiso de Operaciones tampoco.
 * 3. Si ms-ventas responde 409 (el pedido avanzó) se muestra su motivo.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { changeReservationWarehouse } from "@/services/orderStockService";
import { listWarehouses } from "@/services/warehousesService";
import { WAREHOUSES } from "@/components/warehouse-ops/__tests__/fixtures";
import CreateGuideModal from "../CreateGuideModal";

const mockPermissions = new Set<string>(["MANAGE_OPERATIONS"]);
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "company", stores: [{ id: "web" }] }, accessToken: "token" },
    hasPermission: (permission: string) => mockPermissions.has(permission),
  }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/courierService", () => ({ fetchCouriers: jest.fn().mockResolvedValue([{ id: "courier-one", name: "Courier One" }]) }));
jest.mock("@/services/orderStockService", () => ({ changeReservationWarehouse: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "o-1",
  storeId: "web",
  inventoryId: "w-1",
  orderNumber: "ORD-1001",
  clientName: "Cliente",
  address: "Dirección",
  district: "Miraflores",
  total: 50,
  pendingPayment: 0,
  zone: "LIMA_SUR",
  status: "PREPARADO",
  stockState: "reserved",
  externalSource: null,
  ...overrides,
});

function setup(selectedOrders: ReturnType<typeof order>[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CreateGuideModal open onClose={jest.fn()} selectedOrders={selectedOrders} storeId="web" onConfirm={jest.fn()} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions.clear();
  mockPermissions.add("MANAGE_OPERATIONS");
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] });
});

describe("CreateGuideModal: almacén del pedido", () => {
  it("antes del despacho cambia el almacén del pedido", async () => {
    jest.mocked(changeReservationWarehouse).mockResolvedValue({});
    const user = setup([order()]);
    const block = await screen.findByTestId("guide-warehouse-o-1");
    expect(await within(block).findByText("Central")).toBeInTheDocument();

    await user.click(within(block).getByRole("button", { name: "Cambiar el almacén de ORD-1001" }));
    await user.selectOptions(screen.getByLabelText("Almacén de ORD-1001"), "w-2");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(changeReservationWarehouse).toHaveBeenCalledWith("o-1", "w-2"));
    expect(await within(await screen.findByTestId("guide-warehouse-o-1")).findByText("Tienda Sur")).toBeInTheDocument();
  });

  it("no se ofrece en pedidos despachados ni de Live", async () => {
    setup([
      order({ id: "o-2", orderNumber: "ORD-2", status: "EN_ENVIO" }),
      order({ id: "o-3", orderNumber: "ORD-3", stockState: "dispatched" }),
      order({ id: "o-4", orderNumber: "ORD-4", externalSource: "POWIP_LIVE" }),
      order({ id: "o-5", orderNumber: "ORD-5" }),
    ]);
    expect(await screen.findByTestId("guide-warehouse-o-5")).toBeInTheDocument();
    for (const id of ["o-2", "o-3", "o-4"]) expect(screen.queryByTestId(`guide-warehouse-${id}`)).not.toBeInTheDocument();
  });

  it("sin permiso de Operaciones no se ofrece", async () => {
    mockPermissions.clear();
    setup([order()]);
    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.queryByTestId("guide-warehouse-o-1")).not.toBeInTheDocument();
  });

  it("muestra el 409 de ms-ventas cuando el pedido ya avanzó", async () => {
    jest.mocked(changeReservationWarehouse).mockRejectedValue({
      response: { status: 409, data: { message: "El pedido ya salió del almacén: no se puede cambiar." } },
    });
    const user = setup([order()]);
    const block = await screen.findByTestId("guide-warehouse-o-1");
    await within(block).findByText("Central");

    await user.click(within(block).getByRole("button", { name: "Cambiar el almacén de ORD-1001" }));
    await user.selectOptions(screen.getByLabelText("Almacén de ORD-1001"), "w-2");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await within(block).findByRole("alert")).toHaveTextContent("El pedido ya salió del almacén: no se puede cambiar.");
  });

  it("un 409 sin mensaje explica que el pedido avanzó", async () => {
    jest.mocked(changeReservationWarehouse).mockRejectedValue({ response: { status: 409, data: {} } });
    const user = setup([order()]);
    const block = await screen.findByTestId("guide-warehouse-o-1");
    await within(block).findByText("Central");

    await user.click(within(block).getByRole("button", { name: "Cambiar el almacén de ORD-1001" }));
    await user.selectOptions(screen.getByLabelText("Almacén de ORD-1001"), "w-2");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await within(block).findByRole("alert")).toHaveTextContent("Ya no se puede cambiar el almacén: el pedido avanzó o ya salió del almacén.");
  });
});
