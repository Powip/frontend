import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/utils/bulk-receipt-printer", () => ({
  buildReceiptsDocument: jest.fn(),
}));

import { toast } from "sonner";
import { buildReceiptsDocument, type ReceiptData } from "@/utils/bulk-receipt-printer";
import {
  BulkPrintPreviewDialog,
  type PrintPreviewOrder,
} from "../BulkPrintPreviewDialog";

const mockBuild = jest.mocked(buildReceiptsDocument);
const mockToast = toast as jest.Mocked<typeof toast>;

const ORDERS: PrintPreviewOrder[] = [
  { id: "o-2", orderNumber: "ORD-002" },
  { id: "o-1", orderNumber: "ORD-001" },
];

const COMPANY = { name: "Powip Test" };

function receiptFor(order: PrintPreviewOrder): ReceiptData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: { fullName: `Cliente ${order.orderNumber}` },
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof BulkPrintPreviewDialog>> = {}) {
  const props = {
    open: true,
    orders: ORDERS,
    company: COMPANY,
    fetchReceipt: jest.fn(async (order: PrintPreviewOrder) => receiptFor(order)),
    onConfirm: jest.fn(async () => {}),
    onClose: jest.fn(),
    ...overrides,
  };
  const utils = render(<BulkPrintPreviewDialog {...props} />);
  return { ...utils, props };
}

const CONFIRM_STEP = { name: "Confirmar cambio de estado" };

async function confirmStep() {
  await screen.findByRole("region", CONFIRM_STEP);
  return screen.getByRole("dialog");
}

async function waitForFrame() {
  const frame = (await screen.findByTitle("Vista previa de etiquetas")) as HTMLIFrameElement;
  fireEvent.load(frame);
  jest.spyOn(frame.contentWindow as Window, "focus").mockImplementation(() => {});
  return frame;
}

function printButton() {
  return screen.getByRole("button", { name: /Imprimir \/ Guardar PDF/ });
}

async function printFromPreview() {
  const frame = await waitForFrame();
  const print = jest.fn();
  jest.spyOn(frame.contentWindow as Window, "print").mockImplementation(print);
  await waitFor(() => expect(printButton()).toBeEnabled());
  fireEvent.click(printButton());
  return print;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBuild.mockResolvedValue("<!DOCTYPE html><html><body>ETIQUETAS</body></html>");
});

describe("BulkPrintPreviewDialog", () => {
  it("genera la vista previa con el mismo documento de impresión y en el orden seleccionado", async () => {
    const { props } = setup();

    expect(screen.getByRole("status")).toHaveTextContent("Generando etiquetas…");
    expect(printButton()).toBeDisabled();

    const frame = await waitForFrame();

    const fetchCalls = (props.fetchReceipt as jest.Mock).mock.calls as [PrintPreviewOrder][];
    expect(fetchCalls.map(([o]) => o.orderNumber)).toEqual([
      "ORD-002",
      "ORD-001",
    ]);
    expect(mockBuild).toHaveBeenCalledWith(
      [receiptFor(ORDERS[0]), receiptFor(ORDERS[1])],
      COMPANY,
    );
    expect(frame.getAttribute("srcdoc")).toContain("ETIQUETAS");
    await waitFor(() => expect(printButton()).toBeEnabled());
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("no pide recibos ni cambia estados mientras está cerrado", () => {
    const { props } = setup({ open: false });

    expect(screen.queryByText("Vista previa de etiquetas")).not.toBeInTheDocument();
    expect(props.fetchReceipt).not.toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("cerrar sin imprimir solo cierra la vista previa", async () => {
    const { props } = setup();
    await waitForFrame();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("imprime desde el iframe y pide confirmación explícita listando los pedidos", async () => {
    const { props } = setup();

    const print = await printFromPreview();

    expect(print).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    const confirm = await confirmStep();
    expect(confirm).toHaveTextContent("PREPARADO");
    const listed = within(within(confirm).getByRole("list", { name: "Pedidos a actualizar" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(listed).toEqual(["ORD-002", "ORD-001"]);
  });

  it("confirmar ejecuta onConfirm una sola vez y cierra la vista previa", async () => {
    const { props } = setup();
    await printFromPreview();

    const confirm = await confirmStep();
    fireEvent.click(within(confirm).getByRole("button", { name: "Sí, marcar como PREPARADO" }));

    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancelar la confirmación no actualiza pedidos y vuelve a la vista previa", async () => {
    const { props } = setup();
    await printFromPreview();

    const confirm = await confirmStep();
    fireEvent.click(within(confirm).getByRole("button", { name: "Volver" }));

    await waitFor(() => expect(screen.queryByRole("region", CONFIRM_STEP)).not.toBeInTheDocument());
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(mockToast.info).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Marcar como PREPARADO/ })).toBeInTheDocument();
  });

  it("permite reabrir la confirmación después de cancelarla", async () => {
    const { props } = setup();
    await printFromPreview();
    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Volver",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("region", CONFIRM_STEP)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Marcar como PREPARADO/ }));
    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Sí, marcar como PREPARADO",
      }),
    );

    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledTimes(1));
  });

  it("cerrar después de imprimir sin confirmar no actualiza pedidos", async () => {
    const { props } = setup();
    await printFromPreview();
    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Volver",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("region", CONFIRM_STEP)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenLastCalledWith(
      "Vista previa cerrada. Los estados no fueron modificados.",
    );
  });

  it("si el navegador no puede imprimir, avisa y no pide confirmación", async () => {
    const { props } = setup();
    const frame = await waitForFrame();
    jest.spyOn(frame.contentWindow as Window, "print").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    await waitFor(() => expect(printButton()).toBeEnabled());

    fireEvent.click(printButton());

    expect(mockToast.error).toHaveBeenCalledWith(
      "No se pudo abrir el diálogo de impresión del navegador.",
    );
    expect(screen.queryByRole("region", CONFIRM_STEP)).not.toBeInTheDocument();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("muestra qué recibos fallaron, no permite imprimir y reintenta a pedido", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const fetchReceipt = jest
      .fn<Promise<ReceiptData>, [PrintPreviewOrder]>()
      .mockImplementation(async (order) => {
        if (order.id === "o-1") throw new Error("500");
        return receiptFor(order);
      });
    const { props } = setup({ fetchReceipt });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ORD-001");
    expect(alert).not.toHaveTextContent("ORD-002");
    expect(printButton()).toBeDisabled();
    expect(mockBuild).not.toHaveBeenCalled();

    fetchReceipt.mockImplementation(async (order) => receiptFor(order));
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    await waitForFrame();
    await waitFor(() => expect(printButton()).toBeEnabled());
    expect(fetchReceipt).toHaveBeenCalledTimes(4);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("muestra error si falla la generación de etiquetas", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockBuild.mockRejectedValueOnce(new Error("qr"));
    setup();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron generar las etiquetas.",
    );
    expect(printButton()).toBeDisabled();
  });

  it("ignora recibos que llegan después de cerrar la vista previa", async () => {
    let resolveFetch: (r: ReceiptData) => void = () => {};
    const fetchReceipt = jest.fn(
      () => new Promise<ReceiptData>((resolve) => (resolveFetch = resolve)),
    );
    const { rerender, props } = setup({ orders: [ORDERS[0]], fetchReceipt });

    rerender(<BulkPrintPreviewDialog {...props} open={false} />);
    resolveFetch(receiptFor(ORDERS[0]));
    await Promise.resolve();

    expect(mockBuild).not.toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
