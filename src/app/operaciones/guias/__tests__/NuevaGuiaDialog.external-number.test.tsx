import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Operaciones › Guías › «Nueva guía» — N° externo (FEAT-31).
 *
 * El selector de pedidos muestra el N° externo junto al pedido solo si algún pedido elegible lo
 * trae, y la búsqueda del diálogo también lo encuentra.
 */

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("@/hooks/useBusinessOrders", () => ({ useBusinessOrders: jest.fn() }));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "user-1" }, company: { id: "company-1", stores: [] } }, selectedStoreId: "store-1" }),
}));
jest.mock("@/contexts/OperationsRoleContext", () => ({
  ...jest.requireActual("@/contexts/OperationsRoleContext"),
  useOperationsRole: () => ({ can: () => true }),
}));
jest.mock("@/components/modals/CreateGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/AddToExistingGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/GuideDetailsModal", () => ({ __esModule: true, default: () => null }));

import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import type { OrderHeader } from "@/interfaces/IOrder";
import NuevaGuiaDialog from "../_components/NuevaGuiaDialog";

function pedido(id: string, orderNumber: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    orderNumber,
    status: "PREPARADO",
    deliveryType: "DOMICILIO",
    grandTotal: "100.00",
    payments: [],
    items: [],
    created_at: "2026-09-25T15:00:00.000Z",
    updated_at: "2026-09-25T15:00:00.000Z",
    customer: { fullName: `Cliente ${orderNumber}`, district: "Miraflores", zone: "ZONA_1" },
    ...overrides,
  } as unknown as OrderHeader;
}

function mockOrders(orders: OrderHeader[]) {
  jest.mocked(useBusinessOrders).mockReturnValue({
    orders, loading: false, error: false, retry: jest.fn(), refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrders>);
}

const open = () => render(<NuevaGuiaDialog open onOpenChange={jest.fn()} />);

describe("NuevaGuiaDialog — N° externo", () => {
  it("con un pedido que trae N° externo muestra la columna y el número", () => {
    mockOrders([pedido("o-1", "ORD-001", { externalOrderNumber: "AGPE923190" }), pedido("o-2", "ORD-002")]);
    open();

    expect(screen.getByRole("columnheader", { name: "N° Externo" })).toBeInTheDocument();
    expect(screen.getByText("AGPE923190")).toBeInTheDocument();
    expect(screen.getByText("ORD-002")).toBeInTheDocument();
  });

  it("sin ningún N° externo no dibuja la columna", () => {
    mockOrders([pedido("o-1", "ORD-001")]);
    open();

    expect(screen.getByRole("columnheader", { name: "Pedido" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "N° Externo" })).not.toBeInTheDocument();
  });

  it("la búsqueda del diálogo encuentra el pedido por su N° externo", async () => {
    const user = userEvent.setup();
    mockOrders([pedido("o-1", "ORD-001", { externalOrderNumber: "AGPE923190" }), pedido("o-2", "ORD-002")]);
    open();

    await user.type(screen.getByPlaceholderText("Buscar por orden, N° externo, cliente o distrito…"), "AGPE");

    expect(screen.getByText("ORD-001")).toBeInTheDocument();
    expect(screen.queryByText("ORD-002")).not.toBeInTheDocument();
  });
});
