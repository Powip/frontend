import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PickingPanel, { type PickingActions } from "../PickingPanel";
import { QueueRejectedError } from "@/lib/offlineQueue";
import { getPicking, scanPicking, type PickingView } from "@/services/orderStockService";

// FEAT-24 H6-D — el PickingPanel de H2-F en el modo almacén: escrituras por la
// cola (pueden quedar guardadas), lectura con la última copia, tarjetas y
// sonido/vibración por `onFeedback`.

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn() }));
jest.mock("@/hooks/useOperationsPedidos", () => ({ OPERATIONS_PEDIDOS_QUERY_KEY: "operations-pedidos" }));
jest.mock("@/services/orderStockService", () => ({
  getPicking: jest.fn(),
  scanPicking: jest.fn(),
  confirmPickingLine: jest.fn(),
  completePicking: jest.fn(),
}));

function view(picked = 0, overrides: Partial<PickingView> = {}): PickingView {
  return {
    orderId: "o-1",
    orderNumber: "ORD-100",
    status: "EN_ENVIO",
    pickingRequired: false,
    completedAt: null,
    completedBy: null,
    complete: false,
    lines: [
      { itemId: "i-1", productName: "Polo negro M", sku: "POL-M", variantId: "v-1", quantity: 2, picked, manual: 0, pending: 2 - picked, linked: true },
    ],
    ...overrides,
  };
}

function setup(actions: Partial<PickingActions>, extra: { loadView?: () => Promise<PickingView> } = {}) {
  const onFeedback = jest.fn();
  const full: PickingActions = {
    scan: jest.fn(),
    confirmLine: jest.fn(),
    complete: jest.fn(),
    ...actions,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PickingPanel
        orderId="o-1"
        orderNumber="ORD-100"
        actions={full}
        loadView={extra.loadView ?? (async () => view())}
        layout="cards"
        onFeedback={onFeedback}
        renderScanner={(scan) => (
          <button type="button" onClick={() => scan(" 775 ")}>
            simular escaneo
          </button>
        )}
      />
    </QueryClientProvider>,
  );
  return { onFeedback, actions: full };
}

describe("PickingPanel en el modo almacén (FEAT-24 H6-D)", () => {
  it("usa loadView (no el servicio directo) y muestra las líneas en tarjetas con el escáner propio", async () => {
    setup({});
    expect(await screen.findByTestId("picking-line-i-1")).toHaveTextContent("0 de 2");
    expect(getPicking).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Escanear código")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Líneas del pedido" })).toBeInTheDocument();
  });

  it("un escaneo hecho actualiza la línea y avisa «ok»", async () => {
    const { onFeedback, actions } = setup({ scan: jest.fn().mockResolvedValue({ status: "done", result: view(1) }) });
    await userEvent.click(await screen.findByRole("button", { name: "simular escaneo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("+1: Polo negro M (1 de 2)");
    expect(actions.scan).toHaveBeenCalledWith("775");
    expect(onFeedback).toHaveBeenCalledWith("ok");
    expect(scanPicking).not.toHaveBeenCalled();
  });

  it("un escaneo sin señal queda guardado y lo dice", async () => {
    const message = "Sin señal: el escaneo 775 quedó guardado y se envía al volver la conexión.";
    const { onFeedback } = setup({ scan: jest.fn().mockResolvedValue({ status: "queued", message }) });
    await userEvent.click(await screen.findByRole("button", { name: "simular escaneo" }));
    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(onFeedback).toHaveBeenCalledWith("queued");
    expect(screen.getByTestId("picking-line-i-1")).toHaveTextContent("0 de 2");
  });

  it("un rechazo del servidor suena como error con su mensaje", async () => {
    const { onFeedback } = setup({
      scan: jest.fn().mockRejectedValue(new QueueRejectedError("El código 775 no corresponde a ningún producto de este pedido.", 400)),
    });
    await userEvent.click(await screen.findByRole("button", { name: "simular escaneo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El código 775 no corresponde a ningún producto de este pedido.");
    expect(onFeedback).toHaveBeenCalledWith("error");
  });

  it("completar guardado sin señal avisa que se envía después", async () => {
    const message = "Sin señal: el completar quedó guardado y se envía al volver la conexión.";
    setup({ complete: jest.fn().mockResolvedValue({ status: "queued", message }) }, { loadView: async () => view(2) });
    await userEvent.click(await screen.findByRole("button", { name: "Completar" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("completar aplicado sin vista (despacho pendiente en el servidor) vuelve a leer y lo informa", async () => {
    const loadView = jest.fn(async () => view(2));
    setup(
      { complete: jest.fn().mockResolvedValue({ status: "done", message: "El despacho quedó pendiente: se reintenta solo. No hace falta volver a completarlo." }) },
      { loadView },
    );
    await userEvent.click(await screen.findByRole("button", { name: "Completar" }));
    expect(await screen.findByText(/se reintenta solo/)).toBeInTheDocument();
    await waitFor(() => expect(loadView).toHaveBeenCalledTimes(2));
  });
});
