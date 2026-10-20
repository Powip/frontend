import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RegularizeProductModal from "../RegularizeProductModal";
import {
  cancelProductActivation,
  getProductTracking,
  regularizeProduct,
  resumeProductTracking,
  type ProductTrackingContext,
} from "@/services/inventoryTrackingService";

jest.mock("@/services/inventoryTrackingService", () => ({
  ...jest.requireActual("@/services/inventoryTrackingService"),
  getProductTracking: jest.fn(),
  regularizeProduct: jest.fn(),
  resumeProductTracking: jest.fn(),
  cancelProductActivation: jest.fn(),
}));
const get = jest.mocked(getProductTracking);
const regularize = jest.mocked(regularizeProduct);
const context: ProductTrackingContext = {
  productId: "p",
  trackingMode: "NONE",
  variants: [
    {
      variantId: "v1",
      inventoryItemId: "i1",
      inventoryId: "w",
      inventoryName: "Central",
      quantity: 1,
      reservedQuantity: 0,
      unitCount: 0,
      trackingMode: "NONE",
    },
    {
      variantId: "v2",
      inventoryItemId: null,
      inventoryId: "w",
      inventoryName: "Central",
      quantity: 0,
      reservedQuantity: 0,
      unitCount: 0,
      trackingMode: "NONE",
    },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue(context);
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn().mockReturnValue("a52730b3-fbf3-4bd8-87fb-0050227f768e"),
  });
});
it("keeps one operation and all variants on a retry; confirms stock does not increase", async () => {
  const onSaved = jest.fn();
  regularize
    .mockRejectedValueOnce(new Error("Conexión interrumpida"))
    .mockResolvedValueOnce({
      operationId: "op",
      productId: "p",
      trackingMode: "IMEI",
      unitCount: 1,
      stockBefore: 1,
      stockAfter: 1,
    });
  render(
    <RegularizeProductModal
      companyId="c"
      productId="p"
      productName="Celular"
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );
  await screen.findByLabelText(/Variante 1/);
  fireEvent.change(screen.getByLabelText("Identificador por unidad"), {
    target: { value: "IMEI" },
  });
  fireEvent.change(screen.getByLabelText(/Variante 1/), { target: { value: "001234567890123" } });
  fireEvent.click(screen.getByRole("button", { name: "Asociar códigos sin sumar stock" }));
  await screen.findByText("Conexión interrumpida");
  expect(screen.getByLabelText(/Variante 1/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(regularize.mock.calls[1]).toEqual(regularize.mock.calls[0]);
  expect(regularize.mock.calls[0][1].items).toEqual([
    { variantId: "v1", inventoryItemId: "i1", expectedQuantity: 1, codes: ["001234567890123"] },
    { variantId: "v2", inventoryId: "w", expectedQuantity: 0, codes: [] },
  ]);
  expect(screen.getByText(/No se sumaron existencias/)).toBeInTheDocument();
});
it.each([{ reservedQuantity: 1 }, { quantity: -1 }])(
  "blocks current stock that cannot be safely regularized %j",
  async (patch) => {
    get.mockResolvedValue({ ...context, variants: [{ ...context.variants[0], ...patch }] });
    render(
      <RegularizeProductModal
        companyId="c"
        productId="p"
        productName="Celular"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await screen.findByText(/Libera las reservas/);
    expect(screen.getByRole("button", { name: "Asociar códigos sin sumar stock" })).toBeDisabled();
    expect(regularize).not.toHaveBeenCalled();
  },
);
it("cancels and ignores a previous company load", async () => {
  let resolveOld!: (value: ProductTrackingContext) => void;
  get
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValueOnce({
      ...context,
      variants: [{ ...context.variants[0], inventoryName: "Nuevo negocio" }],
    });
  const view = render(
    <RegularizeProductModal
      key="a"
      companyId="a"
      productId="p"
      productName="Celular"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );
  const oldSignal = get.mock.calls[0][1];
  view.rerender(
    <RegularizeProductModal
      key="b"
      companyId="b"
      productId="p"
      productName="Celular"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );
  await screen.findByText(/Nuevo negocio/);
  await act(async () => {
    resolveOld(context);
  });
  expect(oldSignal?.aborted).toBe(true);
  expect(screen.queryByText(/Central/)).not.toBeInTheDocument();
});

it("recovers a durable pending activation without recapturing codes or creating another operation", async () => {
  get.mockResolvedValue({
    ...context,
    pendingActivation: { operationId: "original-op", trackingMode: "SERIAL" },
    variants: [{ ...context.variants[0], unitCount: 1 }],
  });
  jest
    .mocked(resumeProductTracking)
    .mockResolvedValue({
      operationId: "original-op",
      productId: "p",
      trackingMode: "SERIAL",
      unitCount: 1,
      stockBefore: 1,
      stockAfter: 1,
    });
  const onSaved = jest.fn();
  render(
    <RegularizeProductModal
      companyId="c"
      productId="p"
      productName="Celular"
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar activación" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(resumeProductTracking).toHaveBeenCalledWith("p");
  expect(regularize).not.toHaveBeenCalled();
});

it("must fence the durable activation before enabling corrections after a rejection", async () => {
  regularize.mockRejectedValueOnce({
    response: { status: 409, data: { message: "Cambió el stock" } },
  });
  let finishCancellation!: () => void;
  jest.mocked(cancelProductActivation).mockReturnValueOnce(
    new Promise((resolve) => {
      finishCancellation = () => resolve({ status: "ABORTED" });
    }),
  );
  render(
    <RegularizeProductModal
      companyId="c"
      productId="p"
      productName="Celular"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );
  fireEvent.change(await screen.findByLabelText(/Variante 1/), { target: { value: "SERIAL-001" } });
  fireEvent.click(screen.getByRole("button", { name: "Asociar códigos sin sumar stock" }));
  await screen.findByText("Cambió el stock");
  fireEvent.click(screen.getByRole("button", { name: "Corregir datos" }));
  expect(cancelProductActivation).toHaveBeenCalledWith("p");
  expect(screen.getByLabelText(/Variante 1/)).toBeDisabled();
  await act(async () => finishCancellation());
  await waitFor(() => expect(screen.getByLabelText(/Variante 1/)).not.toBeDisabled());
  expect(screen.getByLabelText(/Variante 1/)).toHaveValue("SERIAL-001");
});
