/**
 * Tests: recibir una orden de compra en el escritorio (FEAT-24 H3-E, H3-D11).
 *
 * 1. Empieza con lo pendiente; no deja confirmar más de lo pendiente.
 * 2. Envía solo las líneas con algo por recibir, con un operationId que se repite al reintentar.
 * 3. Un 409 (otra persona recibió) muestra el mensaje y pide refrescar.
 * 4. El lector suma 1 por escaneo y avisa si el código no es de la compra.
 * 5. FEAT-24 H5-L: con lotes pide lote y vencimiento, parte la línea en lotes y muestra el 409 LOTE_VENCIMIENTO_DISTINTO.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { receivePurchaseOrder, type PurchaseOrder } from "@/services/purchasesService";
import { fetchVariantsByIds, lookupVariantsByCodes } from "@/services/variantCodesService";
import ReceivePurchaseOrderDialog from "../ReceivePurchaseOrderDialog";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ receivePurchaseOrder: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn(), fetchVariantsByIds: jest.fn() }));

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

async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ReceivePurchaseOrderDialog order={order} companyId="c-1" onClose={jest.fn()} onReceived={onReceived} onConflict={onConflict} />
    </QueryClientProvider>,
  );
  // FEAT-24 H5-L: primero revisa qué productos manejan lotes.
  await waitFor(() => expect(screen.queryByText("Revisando qué productos manejan lotes…")).not.toBeInTheDocument());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchVariantsByIds).mockResolvedValue([]);
});

describe("recibir OC (escritorio)", () => {
  it("empieza con lo pendiente y no deja recibir más de lo pendiente", async () => {
    const user = userEvent.setup();
    await setup();
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
    await setup();
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
    await setup();
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
    await setup();
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

describe("recibir OC con lotes (FEAT-24 H5-L)", () => {
  // La gorra maneja lotes (crema, en la vida real); el polo no.
  beforeEach(() => {
    jest.mocked(fetchVariantsByIds).mockResolvedValue([
      { id: "v-1", sku: "POLO-SKU", companySku: null, barcode: null, productName: "Polo", attributeValues: {}, codes: [] },
      { id: "v-2", sku: "GORRA-SKU", companySku: null, barcode: null, productName: "Gorra", attributeValues: {}, codes: [], tracksLots: true },
    ] as never);
    jest.mocked(receivePurchaseOrder).mockResolvedValue({ duplicate: false, reception: {} as never, purchaseOrder: order });
  });

  it("pide lote y vencimiento: sin ellos no deja confirmar", async () => {
    const user = userEvent.setup();
    await setup();
    expect(fetchVariantsByIds).toHaveBeenCalledWith(["v-1", "v-2"], "c-1");
    expect(screen.getByLabelText("Recibe ahora: Polo")).toHaveValue(4);
    const lots = screen.getByRole("group", { name: "Lotes: Gorra" });
    expect(within(lots).getByLabelText("Unidades: Gorra")).toHaveValue(5);
    expect(lots).toHaveTextContent("Escribe el número de lote.");
    expect(screen.getByRole("button", { name: /Confirmar recepción/ })).toBeDisabled();
    await user.type(within(lots).getByLabelText("Lote: Gorra"), "L2410");
    expect(lots).toHaveTextContent("Elige la fecha de vencimiento.");
    fireEvent.change(within(lots).getByLabelText("Vencimiento: Gorra"), { target: { value: "2027-10-31" } });
    await user.type(within(lots).getByLabelText("Comentario del lote: Gorra"), "Caja dañada");
    await user.click(screen.getByRole("button", { name: "Confirmar recepción (9)" }));
    await waitFor(() => expect(onReceived).toHaveBeenCalled());
    expect(jest.mocked(receivePurchaseOrder).mock.calls[0][1].lines).toEqual([
      { itemId: "item-1", quantity: 4 },
      { itemId: "item-2", quantity: 5, lotNumber: "L2410", expiresAt: "2027-10-31", lotComment: "Caja dañada" },
    ]);
  });

  it("parte una línea en dos lotes: una línea por lote, con la misma línea de la OC", async () => {
    const user = userEvent.setup();
    await setup();
    const lots = screen.getByRole("group", { name: "Lotes: Gorra" });
    await user.clear(within(lots).getByLabelText("Unidades: Gorra"));
    await user.type(within(lots).getByLabelText("Unidades: Gorra"), "3");
    await user.type(within(lots).getByLabelText("Lote: Gorra"), "L2410");
    fireEvent.change(within(lots).getByLabelText("Vencimiento: Gorra"), { target: { value: "2027-10-31" } });
    await user.click(within(lots).getByRole("button", { name: "Agregar otro lote" }));
    expect(within(lots).getByLabelText("Unidades: Gorra (lote 2)")).toHaveValue(2);
    await user.type(within(lots).getByLabelText("Lote: Gorra (lote 2)"), "L2410");
    fireEvent.change(within(lots).getByLabelText("Vencimiento: Gorra (lote 2)"), { target: { value: "2027-11-30" } });
    expect(lots).toHaveTextContent("El lote L2410 está dos veces con fechas de vencimiento distintas.");
    await user.clear(within(lots).getByLabelText("Lote: Gorra (lote 2)"));
    await user.type(within(lots).getByLabelText("Lote: Gorra (lote 2)"), "L2411");
    expect(lots).toHaveTextContent("Recibe ahora: 5 de 5");
    await user.clear(screen.getByLabelText("Recibe ahora: Polo"));
    await user.click(screen.getByRole("button", { name: "Confirmar recepción (5)" }));
    await waitFor(() => expect(receivePurchaseOrder).toHaveBeenCalled());
    expect(jest.mocked(receivePurchaseOrder).mock.calls[0][1].lines).toEqual([
      { itemId: "item-2", quantity: 3, lotNumber: "L2410", expiresAt: "2027-10-31" },
      { itemId: "item-2", quantity: 2, lotNumber: "L2411", expiresAt: "2027-11-30" },
    ]);
  });

  it("el 409 LOTE_VENCIMIENTO_DISTINTO se muestra y no refresca la compra", async () => {
    const user = userEvent.setup();
    jest.mocked(receivePurchaseOrder).mockRejectedValue({
      response: {
        status: 409,
        data: { code: "LOTE_VENCIMIENTO_DISTINTO", message: "El lote L2410 de GORRA-SKU ya existe con vencimiento 30/09/2027; revisa la fecha (llegó 31/10/2027) o usa otro número." },
      },
    });
    await setup();
    const lots = screen.getByRole("group", { name: "Lotes: Gorra" });
    await user.type(within(lots).getByLabelText("Lote: Gorra"), "L2410");
    fireEvent.change(within(lots).getByLabelText("Vencimiento: Gorra"), { target: { value: "2027-10-31" } });
    await user.click(screen.getByRole("button", { name: /Confirmar recepción/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ya existe con vencimiento 30/09/2027; revisa la fecha (llegó 31/10/2027)");
    expect(onConflict).not.toHaveBeenCalled();
    expect(onReceived).not.toHaveBeenCalled();
  });

  it("el lector suma 1 al último lote de la línea", async () => {
    const user = userEvent.setup();
    jest.mocked(lookupVariantsByCodes).mockResolvedValue([{ code: "7750001", variantId: "v-2", sku: "GORRA-SKU", companySku: null, productId: "p", productName: "Gorra" }]);
    await setup();
    const lots = screen.getByRole("group", { name: "Lotes: Gorra" });
    await user.clear(within(lots).getByLabelText("Unidades: Gorra"));
    await user.type(within(lots).getByLabelText("Unidades: Gorra"), "2");
    await user.click(within(lots).getByRole("button", { name: "Agregar otro lote" }));
    await user.clear(within(lots).getByLabelText("Unidades: Gorra (lote 2)"));
    await user.type(screen.getByLabelText(/Escanear código/), "7750001{Enter}");
    await waitFor(() => expect(within(lots).getByLabelText("Unidades: Gorra (lote 2)")).toHaveValue(1));
    expect(within(lots).getByLabelText("Unidades: Gorra (lote 1)")).toHaveValue(2);
  });

  it("si no se pudo revisar qué productos manejan lotes, avisa y deja recibir igual", async () => {
    jest.mocked(fetchVariantsByIds).mockRejectedValue(new Error("caído"));
    await setup();
    expect(await screen.findByText(/No se pudo revisar qué productos manejan lotes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar recepción (9)" })).toBeEnabled();
  });
});
