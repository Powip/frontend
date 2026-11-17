/**
 * Tests: recibir una orden de compra en el escritorio (FEAT-24 H3-E, H3-D11).
 *
 * 1. Empieza con lo pendiente; no deja confirmar más de lo pendiente.
 * 2. Envía solo las líneas con algo por recibir, con un operationId que se repite al reintentar.
 * 3. Un 409 (otra persona recibió) muestra el mensaje y pide refrescar.
 * 4. El lector suma 1 por escaneo y avisa si el código no es de la compra.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { receivePurchaseOrder, type PurchaseOrder } from "@/services/purchasesService";
import { lookupVariantsByCodes } from "@/services/variantCodesService";
import ReceivePurchaseOrderDialog from "../ReceivePurchaseOrderDialog";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ receivePurchaseOrder: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn() }));

const line = (id: string, variantId: string, productName: string, quantity: number, received: number) => ({
  id,
  variantId,
  sku: `${productName.toUpperCase()}-SKU`,
  productName,
  attributes: null,
  supplierId: "s-1",
  supplierName: "Textiles",
  purchaseUnit: null,
  purchaseFactor: 1,
  purchaseQuantity: quantity,
  quantity,
  receivedQuantity: received,
  returnedQuantity: 0,
  pendingQuantity: quantity - received,
});

const order = {
  id: "oc-1",
  number: "OC-0001",
  status: "RECIBIDA_PARCIAL",
  supplierName: "Textiles",
  document: "F001-1",
  lines: [line("item-1", "v-1", "Polo", 10, 6), line("item-2", "v-2", "Gorra", 5, 0)],
} as unknown as PurchaseOrder;

const onReceived = jest.fn();
const onConflict = jest.fn();

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReceivePurchaseOrderDialog order={order} companyId="c-1" onClose={jest.fn()} onReceived={onReceived} onConflict={onConflict} />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe("recibir OC (escritorio)", () => {
  it("empieza con lo pendiente y no deja recibir más de lo pendiente", async () => {
    const user = userEvent.setup();
    setup();
    const polo = screen.getByLabelText("Recibe ahora: Polo");
    expect(polo).toHaveValue(4);
    expect(screen.getByLabelText("Recibe ahora: Gorra")).toHaveValue(5);
    await user.clear(polo);
    await user.type(polo, "5");
    expect(screen.getByText("No puedes recibir más de lo pendiente (4).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar recepción/ })).toBeDisabled();
    await user.clear(polo);
    await user.type(polo, "4");
    expect(screen.getByRole("button", { name: "Confirmar recepción (9)" })).toBeEnabled();
  });

  it("envía solo lo que se recibe, con el mismo operationId al reintentar", async () => {
    const user = userEvent.setup();
    jest.mocked(receivePurchaseOrder)
      .mockRejectedValueOnce({ response: { status: 503, data: { message: "Servicio no disponible" } } })
      .mockResolvedValueOnce({ duplicate: false, reception: {} as never, purchaseOrder: { ...order, status: "RECIBIDA_PARCIAL" } });
    setup();
    await user.clear(screen.getByLabelText("Recibe ahora: Gorra"));
    await user.click(screen.getByRole("button", { name: "Confirmar recepción (4)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
    await user.click(screen.getByRole("button", { name: "Confirmar recepción (4)" }));
    await waitFor(() => expect(onReceived).toHaveBeenCalled());
    const [first, second] = jest.mocked(receivePurchaseOrder).mock.calls;
    expect(first[0]).toBe("oc-1");
    expect(first[1].lines).toEqual([{ itemId: "item-1", quantity: 4 }]);
    expect(first[1].operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second[1].operationId).toBe(first[1].operationId);
  });

  it("un 409 muestra el mensaje y pide refrescar", async () => {
    const user = userEvent.setup();
    jest.mocked(receivePurchaseOrder).mockRejectedValue({
      response: { status: 409, data: { message: "POLO-SKU: se quiere recibir 4 y quedan 2 pendientes." } },
    });
    setup();
    await user.click(screen.getByRole("button", { name: /Confirmar recepción/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("se quiere recibir 4 y quedan 2 pendientes");
    expect(onConflict).toHaveBeenCalled();
    expect(onReceived).not.toHaveBeenCalled();
  });

  it("el lector suma 1 a la línea de esa variante y avisa si el código no es de la compra", async () => {
    const user = userEvent.setup();
    jest.mocked(lookupVariantsByCodes).mockImplementation(async (codes) =>
      codes[0] === "7750001" ? [{ code: "7750001", variantId: "v-2", sku: "GORRA-SKU", companySku: null, productId: "p", productName: "Gorra" }] : codes[0] === "OTRO" ? [{ code: "OTRO", variantId: "v-9", sku: "X", companySku: null, productId: "p", productName: "X" }] : [],
    );
    setup();
    const gorra = screen.getByLabelText("Recibe ahora: Gorra");
    await user.clear(gorra);
    const scan = screen.getByLabelText(/Escanear código/);
    await user.type(scan, "7750001{Enter}");
    await waitFor(() => expect(gorra).toHaveValue(1));
    expect(screen.getByRole("status")).toHaveTextContent("+1: Gorra (1 de 5)");
    await user.type(scan, "OTRO{Enter}");
    expect(await screen.findByText("El código OTRO no es de esta compra.")).toBeInTheDocument();
    await user.type(scan, "NADA{Enter}");
    expect(await screen.findByText("El código NADA no es de ningún producto de tu catálogo.")).toBeInTheDocument();
  });
});
