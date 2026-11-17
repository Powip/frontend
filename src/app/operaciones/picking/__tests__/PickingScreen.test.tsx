import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PickingScreen from "../_components/PickingScreen";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsPedidos } from "@/hooks/useOperationsPedidos";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useOperationsPedidos", () => ({ useOperationsPedidos: jest.fn() }));
jest.mock("@/components/picking/PickingPanel", () => ({
  __esModule: true,
  default: (props: { orderNumber: string }) => <div>panel de picking {props.orderNumber}</div>,
}));

function loginWith(...permissions: string[]) {
  jest.mocked(useAuth).mockReturnValue({ hasPermission: (permission: string) => permissions.includes(permission) } as unknown as ReturnType<typeof useAuth>);
}

describe("Operaciones › Picking (FEAT-24 H2-F)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useOperationsPedidos).mockReturnValue({
      data: {
        data: [{ id: "o-1", orderNumber: "ORD-100", status: "EN_ENVIO", stockState: "reserved", customer: { fullName: "Ana Pérez" } }],
        total: 1,
        page: 1,
        totalPages: 1,
        counts: { enCamino: 1, preparados: 4 },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useOperationsPedidos>);
  });

  it("lista los pedidos en camino y abre el picking del elegido", async () => {
    const user = userEvent.setup();
    loginWith("UPDATE_DELIVERY_STATUS");
    render(<PickingScreen />);

    expect(useOperationsPedidos).toHaveBeenCalledWith(expect.objectContaining({ tab: "en-camino", page: 1 }), { enabled: true });
    expect(screen.getByRole("tab", { name: /Preparados/ })).toHaveTextContent("4");
    expect(screen.getByText("Stock: Reservado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir picking de ORD-100" }));
    expect(screen.getByText("panel de picking ORD-100")).toBeInTheDocument();
  });

  it("sin permiso de Operaciones no pide pedidos", () => {
    loginWith("VIEW_SALES");
    render(<PickingScreen />);

    expect(screen.getByText("No tienes acceso al picking")).toBeInTheDocument();
    expect(useOperationsPedidos).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });
});
