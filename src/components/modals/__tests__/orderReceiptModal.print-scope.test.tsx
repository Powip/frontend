import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "@/lib/axiosAuth";
import { downloadNotaVentaPdf } from "@/utils/downloadNotaVentaPdf";
import { printOrderLabel } from "@/utils/printOrderLabel";
import { toast } from "sonner";
import OrderReceiptModal from "../orderReceiptModal";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock("@/utils/downloadNotaVentaPdf", () => ({
  downloadNotaVentaPdf: jest.fn(),
}));
jest.mock("@/utils/printOrderLabel", () => ({ printOrderLabel: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("@/components/registrar-venta/SaleTrackingRecovery", () => ({
  SaleAssignmentStatus: () => null,
}));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleActions", () => ({
  __esModule: true,
  default: ({ order, onUpdated }: any) => (
    <button
      onClick={() =>
        onUpdated({ ...order, status: "ANULADO", stockVersion: 3 })
      }
    >
      Simular devolución
    </button>
  ),
}));
jest.mock("../PaymentProofUploadModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../orderReceiptView", () => ({
  __esModule: true,
  default: ({ data }: any) => <p>{data.orderNumber}</p>,
}));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
const auth = {
  company: { id: "company-a" },
  user: { id: "user-a" },
  accessToken: "fixture",
};
const receipt = {
  orderId: "order-1",
  orderNumber: "NV-001",
  status: "PREPARADO",
  customer: {},
  items: [],
};
const props = { open: true, orderId: "order-1", onClose: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(printOrderLabel).mockReset().mockResolvedValue(undefined);
  jest.mocked(downloadNotaVentaPdf).mockReset().mockResolvedValue(undefined);
  jest.mocked(axios.patch).mockReset().mockResolvedValue({ data: {} });
  jest.mocked(useAuth).mockReturnValue({ auth } as any);
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.test";
  jest.mocked(axios.get).mockImplementation(async (url: any) => ({
    data: String(url).endsWith("/receipt")
      ? receipt
      : { id: "order-1", unitAssignmentStatus: "NONE" },
  }));
});

describe("preparing an order when printing its receipt", () => {
  function loadOrder(status: string, tracked = false) {
    const header = {
      id: "order-1",
      status,
      unitAssignmentStatus: tracked ? "CONFIRMED" : "NONE",
      ...(tracked && {
        hasTrackedUnits: true,
        stockVersion: 1,
        confirmedStockVersion: 1,
      }),
    };
    jest.mocked(axios.get).mockImplementation(async (url: any) => ({
      data: String(url).endsWith("/receipt") ? { ...receipt, status } : header,
    }));
    return header;
  }

  it.each(["PENDIENTE", "PAGADO"])(
    "updates %s to PREPARADO before printing and refreshes the parent list",
    async (status) => {
      loadOrder(status);
      let finishPatch!: () => void;
      jest.mocked(axios.patch).mockImplementationOnce(
        () => new Promise((resolve) => { finishPatch = () => resolve({ data: {} }); }),
      );
      const onStatusChange = jest.fn();
      render(<OrderReceiptModal {...props} onStatusChange={onStatusChange} />);
      await screen.findByText("NV-001");
      fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
      expect(axios.patch).toHaveBeenCalledWith(
        "https://ventas.test/order-header/order-1",
        { status: "PREPARADO" },
      );
      expect(printOrderLabel).not.toHaveBeenCalled();
      expect(onStatusChange).not.toHaveBeenCalled();
      await act(async () => finishPatch());
      expect(printOrderLabel).toHaveBeenCalledTimes(1);
      expect(onStatusChange).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith("Estado actualizado a PREPARADO");
    },
  );

  it("prepares a paid order with reserved serials through the authenticated status endpoint", async () => {
    const header = loadOrder("PAGADO", true);
    render(<OrderReceiptModal {...props} />);
    await screen.findByText("NV-001");
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(printOrderLabel).toHaveBeenCalledTimes(1));
    expect(axios.patch).toHaveBeenCalledWith(
      "https://ventas.test/order-header/manual/order-1/status",
      { status: "PREPARADO" },
    );
    expect(printOrderLabel).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1" }), header, auth.company, expect.any(Object),
    );
  });

  it.each(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO", "ANULADO"])(
    "prints %s without changing it back to PREPARADO",
    async (status) => {
      loadOrder(status);
      render(<OrderReceiptModal {...props} />);
      await screen.findByText("NV-001");
      fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
      await waitFor(() => expect(printOrderLabel).toHaveBeenCalledTimes(1));
      expect(axios.patch).not.toHaveBeenCalled();
    },
  );

  it("stops printing and reports the backend error when preparing a paid order fails", async () => {
    loadOrder("PAGADO");
    jest.mocked(axios.patch).mockRejectedValueOnce({
      response: { data: { message: "Stock insuficiente para preparar el pedido" } },
    });
    const onStatusChange = jest.fn();
    render(<OrderReceiptModal {...props} onStatusChange={onStatusChange} />);
    await screen.findByText("NV-001");
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Stock insuficiente para preparar el pedido", { duration: 8000 },
    ));
    expect(printOrderLabel).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps the serial-reservation guard before preparing a paid order", async () => {
    jest.mocked(axios.get).mockImplementation(async (url: any) => ({
      data: String(url).endsWith("/receipt")
        ? { ...receipt, status: "PAGADO" }
        : { id: "order-1", status: "PAGADO", unitAssignmentStatus: "PENDING", hasTrackedUnits: true },
    }));
    render(<OrderReceiptModal {...props} />);
    await screen.findByText("NV-001");
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("pendiente"));
    expect(axios.patch).not.toHaveBeenCalled();
    expect(printOrderLabel).not.toHaveBeenCalled();
  });
});
it.each(["company", "order", "close"])(
  "cancels private PDF work on %s change and immediately hides the old receipt",
  async (change) => {
    let finish!: () => void;
    jest.mocked(downloadNotaVentaPdf).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<OrderReceiptModal {...props} />);
    await screen.findByText("NV-001");
    fireEvent.click(screen.getByRole("button", { name: "Nota de venta" }));
    await waitFor(() => expect(downloadNotaVentaPdf).toHaveBeenCalledTimes(1));
    const options = jest.mocked(downloadNotaVentaPdf).mock.calls[0][3]!;
    expect(options.isCurrent?.()).toBe(true);
    jest.mocked(axios.get).mockImplementation(() => new Promise(() => {}));
    if (change === "company")
      jest.mocked(useAuth).mockReturnValue({
        auth: { ...auth, company: { id: "company-b" } },
      } as any);
    view.rerender(
      <OrderReceiptModal
        {...props}
        orderId={change === "order" ? "order-2" : "order-1"}
        open={change !== "close"}
      />,
    );
    expect(options.signal?.aborted).toBe(true);
    expect(options.isCurrent?.()).toBe(false);
    expect(screen.queryByText("NV-001")).not.toBeInTheDocument();
    await act(async () => finish());
  },
);
it("passes a live cancelable operation to the single-label printer", async () => {
  let finish!: () => void;
  jest.mocked(printOrderLabel).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<OrderReceiptModal {...props} />);
  await screen.findByText("NV-001");
  fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
  await waitFor(() => expect(printOrderLabel).toHaveBeenCalledTimes(1));
  const options = jest.mocked(printOrderLabel).mock.calls[0][3]!;
  expect(options.isCurrent?.()).toBe(true);
  view.unmount();
  expect(options.signal?.aborted).toBe(true);
  await act(async () => finish());
});
it("does not offer printing when the authenticated response belongs to another order", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest
    .mocked(axios.get)
    .mockImplementation(async (url: any) => ({
      data: String(url).endsWith("/receipt")
        ? { ...receipt, orderId: "foreign-order" }
        : { id: "order-1", unitAssignmentStatus: "NONE" },
    }));
  render(<OrderReceiptModal {...props} />);
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("NV-001")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Imprimir" })).toBeDisabled();
  expect(printOrderLabel).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

it("reloads the confirmed receipt and cancels old document work after returning its units", async () => {
  let finish!: () => void;
  jest.mocked(downloadNotaVentaPdf).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const delivered = {
    ...receipt,
    status: "ENTREGADO",
    stockVersion: 2,
    confirmedStockVersion: 2,
  };
  jest
    .mocked(axios.get)
    .mockImplementation(async (url: any) => ({
      data: String(url).endsWith("/receipt")
        ? delivered
        : { id: "order-1", status: "ENTREGADO", stockVersion: 2 },
    }));
  render(<OrderReceiptModal {...props} />);
  await screen.findByText("NV-001");
  fireEvent.click(screen.getByRole("button", { name: "Nota de venta" }));
  const oldOperation = jest.mocked(downloadNotaVentaPdf).mock.calls[0][3]!;
  let respond!: (value: any) => void;
  const returned = {
    ...delivered,
    status: "ANULADO",
    stockVersion: 3,
    confirmedStockVersion: 3,
  };
  jest.mocked(axios.get).mockImplementation((url: any) =>
    String(url).endsWith("/receipt")
      ? new Promise((resolve) => {
          respond = resolve;
        })
      : Promise.resolve({
          data: { id: "order-1", status: "ANULADO", stockVersion: 3 },
        }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Simular devolución" }));
  expect(screen.getByRole("button", { name: "Nota de venta" })).toBeDisabled();
  expect(oldOperation.signal?.aborted).toBe(true);
  await waitFor(() => expect(respond).toBeDefined());
  await act(async () => {
    respond({ data: returned });
    finish();
  });
  await screen.findByText("NV-001");
  fireEvent.click(screen.getByRole("button", { name: "Nota de venta" }));
  expect(jest.mocked(downloadNotaVentaPdf).mock.calls[1][0]).toMatchObject({
    status: "ANULADO",
    stockVersion: 3,
  });
});
