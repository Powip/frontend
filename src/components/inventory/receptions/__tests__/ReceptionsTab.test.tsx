/**
 * Tests: Inventario › Recepciones (FEAT-24 H2-F).
 *
 * 1. «Por recibir» muestra pedido, almacén, fecha y productos con nombre y SKU.
 * 2. Recibir a mano: reingreso + merma = lo devuelto, motivo de merma, almacén
 *    de reingreso; manda toda la devolución de una vez.
 * 3. Escaneo: suma 1 al reingreso; un código ajeno o de una línea completa da
 *    error visible y sonido.
 * 4. `duplicate: true` = «ya estaba recibida»; 409 muestra el mensaje.
 * 5. «Recibidas» muestra cómo se recibió; quien no edita no ve «Recibir».
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { playErrorBeep } from "@/lib/errorBeep";
import { fetchVariantsByIds, lookupVariantsByCodes } from "@/services/variantCodesService";
import {
  listReturnReceptions,
  listWarehouses,
  receiveReturnReception,
  type CompanyWarehouse,
  type ReturnReception,
} from "@/services/warehousesService";
import ReceptionsTab from "../ReceptionsTab";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({
  fetchVariantsByIds: jest.fn(),
  lookupVariantsByCodes: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({
  listReturnReceptions: jest.fn(),
  listWarehouses: jest.fn(),
  receiveReturnReception: jest.fn(),
}));

const mockList = jest.mocked(listReturnReceptions);
const mockReceive = jest.mocked(receiveReturnReception);
const mockLookup = jest.mocked(lookupVariantsByCodes);

const COMPANY = "c-1";
const CENTRAL = "11111111-1111-4111-8111-111111111111";
const SUR = "22222222-2222-4222-8222-222222222222";
const POLO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GORRA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AJENO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const warehouse = (id: string, name: string): CompanyWarehouse => ({
  id,
  name,
  status: true,
  store_id: "s-1",
  company_id: COMPANY,
  type: "PROPIO",
  is_main: id === CENTRAL,
});

const pending: ReturnReception = {
  id: "rec-1",
  companyId: COMPANY,
  orderId: "99999999-9999-4999-8999-999999999999",
  orderNumber: "ORD-157001",
  inventoryId: CENTRAL,
  status: "por_recibir",
  lines: [
    { variantId: POLO, quantity: 3 },
    { variantId: GORRA, quantity: 1 },
  ],
  createdAt: "2026-11-17T15:00:00.000Z",
  receivedAt: null,
  receivedBy: null,
  receivedByName: null,
  receivedInventoryId: null,
  receivedLines: null,
};

const received: ReturnReception = {
  ...pending,
  id: "rec-0",
  orderNumber: "ORD-156900",
  status: "recibida",
  receivedAt: "2026-11-16T20:30:00.000Z",
  receivedBy: "ana@empresa.pe",
  receivedByName: "ana@empresa.pe",
  receivedInventoryId: SUR,
  receivedLines: [
    { variantId: POLO, quantity: 2, result: "reingreso", reason: null },
    { variantId: POLO, quantity: 1, result: "merma", reason: "Manchado" },
  ],
};

const match = (variantId: string, code: string) => ({ code, variantId, sku: "S", companySku: null, productId: "p", productName: "P" });

function renderTab(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReceptionsTab companyId={COMPANY} canEdit={canEdit} scopeInventoryIds={null} />
    </QueryClientProvider>,
  );
}

async function openReceive(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Recibir ORD-157001" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockImplementation(async (status) => (status === "por_recibir" ? [pending] : [received]));
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: [warehouse(CENTRAL, "Central"), warehouse(SUR, "Almacén Sur")], links: [] });
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: POLO, sku: "POW-POLO-M", companySku: "POLO-M", barcode: "7750000000001", powipEan: null, attributeValues: { Talla: "M" }, productName: "Polo" },
    { id: GORRA, sku: "POW-GORRA", companySku: null, barcode: null, powipEan: "2000000000015", attributeValues: {}, productName: "Gorra" },
  ]);
});

describe("Recepciones de devoluciones (FEAT-24 H2-F)", () => {
  it("muestra la bandeja «Por recibir» con pedido, almacén, fecha y productos", async () => {
    renderTab();
    const row = await screen.findByTestId("reception-rec-1");
    expect(within(row).getByText("ORD-157001")).toBeInTheDocument();
    expect(await within(row).findByText("Polo · Talla: M")).toBeInTheDocument();
    expect(within(row).getByText("SKU POLO-M · POW-POLO-M")).toBeInTheDocument();
    expect(within(row).getByText("× 3")).toBeInTheDocument();
    expect(within(row).getByText("Gorra")).toBeInTheDocument();
    expect(await within(row).findByText("Central")).toBeInTheDocument();
    expect(within(row).getByText("17/11/26, 10:00")).toBeInTheDocument();
    expect(fetchVariantsByIds).toHaveBeenCalledWith([POLO, GORRA], COMPANY);
  });

  it("recibe a mano: exige que cuadre y el motivo de la merma, y manda todo junto", async () => {
    const user = userEvent.setup();
    mockReceive.mockResolvedValue({ ...pending, status: "recibida" });
    renderTab();
    const dialog = await openReceive(user);
    const confirm = within(dialog).getByRole("button", { name: "Confirmar recepción" });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByText("Faltan 3 por asignar: reingreso + merma tiene que dar 3.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("A stock: Polo · Talla: M"));
    await user.type(within(dialog).getByLabelText("A stock: Polo · Talla: M"), "2");
    await user.clear(within(dialog).getByLabelText("Merma: Polo · Talla: M"));
    await user.type(within(dialog).getByLabelText("Merma: Polo · Talla: M"), "1");
    expect(within(dialog).getByText("Indica el motivo de la merma.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Motivo de la merma: Polo · Talla: M"), "Manchado");
    await user.clear(within(dialog).getByLabelText("A stock: Gorra"));
    await user.type(within(dialog).getByLabelText("A stock: Gorra"), "1");
    await user.selectOptions(within(dialog).getByLabelText("Reingresa a"), SUR);
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    await waitFor(() =>
      expect(mockReceive).toHaveBeenCalledWith("rec-1", {
        inventoryId: SUR,
        lines: [
          { variantId: POLO, quantity: 2, result: "reingreso" },
          { variantId: POLO, quantity: 1, result: "merma", reason: "Manchado" },
          { variantId: GORRA, quantity: 1, result: "reingreso" },
        ],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Devolución ORD-157001 recibida");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("no deja confirmar si sobra", async () => {
    const user = userEvent.setup();
    renderTab();
    const dialog = await openReceive(user);
    await user.click(within(dialog).getByRole("button", { name: "Lo que falta, a stock" }));
    expect(within(dialog).getByRole("button", { name: "Confirmar recepción" })).toBeEnabled();
    await user.clear(within(dialog).getByLabelText("Merma: Gorra"));
    await user.type(within(dialog).getByLabelText("Merma: Gorra"), "1");
    expect(within(dialog).getByText("Sobra 1: volvieron 1.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();
  });

  it("cada escaneo suma 1 a stock en la línea que coincide (y repite sin volver a consultar)", async () => {
    const user = userEvent.setup();
    mockLookup.mockImplementation(async ([code]) => (code === "7750000000001" ? [match(POLO, code)] : [match(GORRA, code)]));
    renderTab();
    const dialog = await openReceive(user);
    const scan = within(dialog).getByLabelText("Escanear código");
    expect(scan).toHaveFocus();

    await user.type(scan, "7750000000001{Enter}");
    await waitFor(() => expect(within(dialog).getByLabelText("A stock: Polo · Talla: M")).toHaveValue(1));
    expect(within(dialog).getByRole("status")).toHaveTextContent("+1 a stock: Polo · Talla: M (1 de 3)");
    expect(scan).toHaveValue("");
    await user.type(scan, "7750000000001{Enter}");
    await waitFor(() => expect(within(dialog).getByLabelText("A stock: Polo · Talla: M")).toHaveValue(2));
    expect(mockLookup).toHaveBeenCalledTimes(1);
    expect(mockLookup).toHaveBeenCalledWith(["7750000000001"], COMPANY);

    await user.type(scan, "2000000000015{Enter}");
    await waitFor(() => expect(within(dialog).getByLabelText("A stock: Gorra")).toHaveValue(1));
    expect(playErrorBeep).not.toHaveBeenCalled();
  });

  it("un código que no es de ninguna línea pendiente muestra el error y suena", async () => {
    const user = userEvent.setup();
    mockLookup.mockImplementation(async ([code]) => {
      if (code === "AJENO-1") return [match(AJENO, code)];
      if (code === "GORRA") return [match(GORRA, code)];
      return [];
    });
    renderTab();
    const dialog = await openReceive(user);
    const scan = within(dialog).getByLabelText("Escanear código");

    await user.type(scan, "AJENO-1{Enter}");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El código AJENO-1 no es de ningún producto pendiente de esta devolución.",
    );
    expect(playErrorBeep).toHaveBeenCalledTimes(1);

    await user.type(scan, "NADA{Enter}");
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent("El código NADA no es de ningún producto de tu empresa."),
    );

    // La gorra volvió 1: el segundo escaneo ya no tiene a dónde sumar.
    await user.type(scan, "GORRA{Enter}");
    await waitFor(() => expect(within(dialog).getByLabelText("A stock: Gorra")).toHaveValue(1));
    await user.type(scan, "GORRA{Enter}");
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Gorra ya está completo"));
    expect(playErrorBeep).toHaveBeenCalledTimes(3);
    expect(within(dialog).getByLabelText("A stock: Gorra")).toHaveValue(1);
  });

  it("una respuesta duplicate se muestra como «ya estaba recibida»", async () => {
    const user = userEvent.setup();
    mockReceive.mockResolvedValue({ ...pending, status: "recibida", duplicate: true });
    renderTab();
    const dialog = await openReceive(user);
    await user.click(within(dialog).getByRole("button", { name: "Lo que falta, a stock" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("La devolución ORD-157001 ya estaba recibida."));
    // Sin almacén distinto, el cuerpo no lo manda.
    expect(mockReceive.mock.calls[0][1]).not.toHaveProperty("inventoryId");
  });

  it("un 409 muestra el mensaje del servidor y refresca la bandeja", async () => {
    const user = userEvent.setup();
    mockReceive.mockRejectedValue({ response: { status: 409, data: { message: "La recepción ya fue registrada." } } });
    renderTab();
    const dialog = await openReceive(user);
    const callsBefore = mockList.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Lo que falta, a stock" }));
    await user.click(within(dialog).getByRole("button", { name: "Confirmar recepción" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("La recepción ya fue registrada.");
    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("«Recibidas» muestra cómo se recibió, a dónde y quién", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByTestId("reception-rec-1");
    await user.click(screen.getByRole("tab", { name: "Recibidas" }));
    const row = await screen.findByTestId("received-rec-0");
    expect(within(row).getByText("2 a stock")).toBeInTheDocument();
    expect(within(row).getByText("1 merma (Manchado)")).toBeInTheDocument();
    expect(within(row).getByText("Almacén Sur")).toBeInTheDocument();
    expect(within(row).getByText("por ana@empresa.pe")).toBeInTheDocument();
  });

  it("quien no edita inventario ve la bandeja sin «Recibir»", async () => {
    renderTab(false);
    await screen.findByTestId("reception-rec-1");
    expect(screen.queryByRole("button", { name: /Recibir/ })).not.toBeInTheDocument();
    expect(screen.getByText("Recibir devoluciones es de Administración y Operaciones.")).toBeInTheDocument();
  });

  it("si la bandeja no carga, avisa y deja reintentar", async () => {
    const user = userEvent.setup();
    mockList.mockRejectedValueOnce({ response: { status: 503, data: { message: "Servicio no disponible" } } });
    renderTab();
    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByTestId("reception-rec-1")).toBeInTheDocument();
  });
});
