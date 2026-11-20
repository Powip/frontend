import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import PickingPanel from "../PickingPanel";
import { playErrorBeep } from "@/lib/errorBeep";
import {
  completePicking,
  confirmPickingLine,
  getPicking,
  scanPicking,
  type PickingLine,
  type PickingView,
} from "@/services/orderStockService";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn() }));
jest.mock("@/hooks/useOperationsPedidos", () => ({ OPERATIONS_PEDIDOS_QUERY_KEY: "operations-pedidos" }));
jest.mock("@/services/orderStockService", () => ({
  getPicking: jest.fn(),
  scanPicking: jest.fn(),
  confirmPickingLine: jest.fn(),
  completePicking: jest.fn(),
}));

function line(overrides: Partial<PickingLine> = {}): PickingLine {
  return {
    itemId: "i-1",
    productName: "Polo negro M",
    sku: "POL-M",
    variantId: "v-1",
    quantity: 2,
    picked: 0,
    manual: 0,
    pending: 2,
    linked: true,
    ...overrides,
  };
}

function view(overrides: Partial<PickingView> = {}): PickingView {
  return {
    orderId: "o-1",
    orderNumber: "ORD-100",
    status: "EN_ENVIO",
    pickingRequired: false,
    completedAt: null,
    completedBy: null,
    complete: false,
    lines: [line()],
    ...overrides,
  };
}

function renderPanel(onDispatched = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PickingPanel orderId="o-1" orderNumber="ORD-100" onDispatched={onDispatched} />
    </QueryClientProvider>,
  );
  return { onDispatched };
}

const scanner = () => screen.getByLabelText("Escanear código");

describe("picking del pedido (FEAT-24 H2-F)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getPicking).mockResolvedValue(view());
  });

  it("el escaneo correcto suma una unidad y deja el foco en el lector", async () => {
    const user = userEvent.setup();
    jest.mocked(scanPicking).mockResolvedValue(view({ pickingRequired: null, lines: [line({ picked: 1, pending: 1 })] }));
    renderPanel();
    await waitFor(() => expect(scanner()).toHaveFocus());
    await user.type(scanner(), "7750000000001{Enter}");

    expect(scanPicking).toHaveBeenCalledWith("o-1", "7750000000001");
    expect(await screen.findByRole("status")).toHaveTextContent("+1: Polo negro M (1 de 2)");
    expect(within(screen.getByTestId("picking-line-i-1")).getByText("Faltan 1")).toBeInTheDocument();
    expect(screen.getByText("1 de 2 unidades tomadas")).toBeInTheDocument();
    expect(scanner()).toHaveValue("");
    expect(scanner()).toHaveFocus();
    expect(playErrorBeep).not.toHaveBeenCalled();
  });

  it("un código que no es del pedido suena y muestra el mensaje del servidor", async () => {
    const user = userEvent.setup();
    jest.mocked(scanPicking).mockRejectedValue({
      response: { status: 400, data: { message: "El código 999 no corresponde a ningún producto de este pedido." } },
    });
    renderPanel();
    await user.type(await screen.findByLabelText("Escanear código"), "999{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("El código 999 no corresponde a ningún producto de este pedido.");
    expect(playErrorBeep).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId("picking-line-i-1")).getByText("Faltan 2")).toBeInTheDocument();
  });

  it("completar con faltantes (409) muestra el faltante del servidor y no despacha", async () => {
    const user = userEvent.setup();
    jest.mocked(completePicking).mockRejectedValue({
      response: { status: 409, data: { message: "Faltan productos por tomar: Polo negro M (2)." } },
    });
    const { onDispatched } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Completar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Faltan productos por tomar: Polo negro M (2).");
    expect(onDispatched).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("completar con logística caída (503) avisa que quedó pendiente y se reintenta solo", async () => {
    const user = userEvent.setup();
    jest.mocked(completePicking).mockRejectedValue({ response: { status: 503, data: { message: "Logística no respondió." } } });
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Completar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("quedó pendiente: se reintenta solo");
  });

  it("completar despacha el pedido", async () => {
    const user = userEvent.setup();
    jest.mocked(completePicking).mockResolvedValue({ ...view({ complete: true, lines: [line({ picked: 2, pending: 0 })] }), dispatched: true });
    const { onDispatched } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Completar" }));

    await waitFor(() => expect(onDispatched).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Pedido ORD-100 despachado");
  });

  it("desde Preparados el picking queda listo y muestra el aviso del servidor", async () => {
    const user = userEvent.setup();
    jest.mocked(completePicking).mockResolvedValue({
      ...view({ status: "PREPARADO", complete: true, lines: [line({ picked: 2, pending: 0 })] }),
      dispatched: false,
      message: "Picking completo. El pedido está en PREPARADO: se despacha cuando pase a DESPACHADO.",
    });
    const { onDispatched } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Completar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Picking completo. El pedido está en PREPARADO");
    expect(onDispatched).not.toHaveBeenCalled();
  });

  it("«Confirmar sin escanear» solo si la empresa no exige picking; un 403 lo oculta", async () => {
    const user = userEvent.setup();
    jest.mocked(confirmPickingLine).mockRejectedValue({
      response: { status: 403, data: { message: "La empresa exige escanear cada producto." } },
    });
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Confirmar sin escanear Polo negro M" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La empresa exige escanear cada producto.");
    expect(screen.queryByRole("button", { name: /Confirmar sin escanear/ })).not.toBeInTheDocument();
  });

  it("si la empresa exige escaneo no ofrece confirmar sin escanear, ni después de escanear", async () => {
    const user = userEvent.setup();
    jest.mocked(getPicking).mockResolvedValue(view({ pickingRequired: true }));
    jest.mocked(scanPicking).mockResolvedValue(view({ pickingRequired: null, lines: [line({ picked: 1, pending: 1 })] }));
    renderPanel();
    await screen.findByTestId("picking-panel");
    expect(screen.queryByRole("button", { name: /Confirmar sin escanear/ })).not.toBeInTheDocument();
    await user.type(scanner(), "POL-M{Enter}");
    await screen.findByText("Faltan 1");
    expect(screen.queryByRole("button", { name: /Confirmar sin escanear/ })).not.toBeInTheDocument();
    expect(screen.getByText("La empresa exige escanear cada producto.")).toBeInTheDocument();
  });

  it("confirma una línea sin escanear cuando está permitido", async () => {
    const user = userEvent.setup();
    jest.mocked(confirmPickingLine).mockResolvedValue(view({ pickingRequired: false, lines: [line({ picked: 2, manual: 2, pending: 0 })] }));
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Confirmar sin escanear Polo negro M" }));

    expect(confirmPickingLine).toHaveBeenCalledWith("o-1", "i-1");
    expect(await screen.findByText("2 sin escanear")).toBeInTheDocument();
    expect(within(screen.getByTestId("picking-line-i-1")).getByText("Listo")).toBeInTheDocument();
  });
});
