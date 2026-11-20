import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { lookupVariantsByCodes } from "@/services/variantCodesService";
import { receiveReturnReception, type ReturnReception } from "@/services/warehousesService";
import ReceiveReturnDialog from "../ReceiveReturnDialog";

// FEAT-24 H6-D — el diálogo de recepción de H2-F en el modo almacén: la
// recepción va por la cola (puede quedar guardada), los códigos se resuelven
// sin señal con los productos descargados y el escáner es el del celular.

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ receiveReturnReception: jest.fn() }));
jest.mock("@/hooks/useMyWarehouses");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const POLO = "11111111-1111-4111-8111-111111111111";
const CENTRAL = "22222222-2222-4222-8222-222222222222";

const reception: ReturnReception = {
  id: "rec-1",
  companyId: "c-1",
  orderId: "o-1",
  orderNumber: "ORD-157001",
  inventoryId: CENTRAL,
  status: "por_recibir",
  lines: [{ variantId: POLO, quantity: 1 }],
  createdAt: "2026-11-17T15:00:00.000Z",
  receivedAt: null,
  receivedBy: null,
  receivedByName: null,
  receivedInventoryId: null,
  receivedLines: null,
};

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

function renderDialog(props: Partial<ComponentProps<typeof ReceiveReturnDialog>>) {
  const onReceived = jest.fn();
  const onFeedback = jest.fn();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ReceiveReturnDialog
        reception={reception}
        companyId="c-1"
        warehouses={[{ id: CENTRAL, name: "Central", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: true }]}
        label={() => ({ name: "Polo", detail: "" })}
        onClose={jest.fn()}
        onReceived={onReceived}
        onConflict={jest.fn()}
        onFeedback={onFeedback}
        renderScanner={(scan) => (
          <button type="button" onClick={() => scan("775")}>
            simular escaneo
          </button>
        )}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onReceived, onFeedback };
}

beforeEach(() => {
  jest.clearAllMocks();
  __setMyWarehouses(null);
});

describe("Recepción en el modo almacén (FEAT-24 H6-D)", () => {
  it("«Reingresa a» ofrece el almacén del pedido y solo los otros que el usuario opera (FEAT-24 H6)", () => {
    __setMyWarehouses({ all: false, inventoryIds: [CENTRAL, "w-sur", "w-lima"], operableIds: ["w-sur"] });
    renderDialog({
      warehouses: [
        { id: CENTRAL, name: "Central", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: true },
        { id: "w-sur", name: "Sur", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: false },
        { id: "w-lima", name: "Lima", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: false },
      ],
    });
    const options = within(screen.getByLabelText("Reingresa a")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Central (almacén del pedido)", "Sur"]);
  });

  it("sin señal resuelve el código con los productos ya descargados", async () => {
    jest.mocked(lookupVariantsByCodes).mockRejectedValue(networkError());
    const localLookup = jest.fn(() => [{ code: "775", variantId: POLO, sku: "S", companySku: null, productId: "", productName: "Polo" }]);
    const { onFeedback } = renderDialog({ localLookup });
    await userEvent.click(screen.getByRole("button", { name: "simular escaneo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("+1 a stock: Polo (1 de 1)");
    expect(localLookup).toHaveBeenCalledWith("775");
    expect(onFeedback).toHaveBeenCalledWith("ok");
  });

  it("sin localLookup, el error de red se muestra como siempre", async () => {
    jest.mocked(lookupVariantsByCodes).mockRejectedValue(networkError());
    const { onFeedback } = renderDialog({});
    await userEvent.click(screen.getByRole("button", { name: "simular escaneo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo revisar el código 775.");
    expect(onFeedback).toHaveBeenCalledWith("error");
  });

  it("la recepción va por `submit` y, si queda guardada, lo avisa y cierra", async () => {
    jest.mocked(lookupVariantsByCodes).mockResolvedValue([{ code: "775", variantId: POLO, sku: "S", companySku: null, productId: "p", productName: "Polo" }]);
    const message = "Sin señal: la recepción quedó guardada y se envía al volver la conexión.";
    const submit = jest.fn().mockResolvedValue({ status: "queued", message });
    const { onReceived } = renderDialog({ submit });
    await userEvent.click(screen.getByRole("button", { name: "simular escaneo" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(await within(dialog).findByRole("button", { name: "Confirmar recepción" }));
    expect(submit).toHaveBeenCalledWith({ lines: [{ variantId: POLO, quantity: 1, result: "reingreso" }] });
    expect(receiveReturnReception).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(message);
    expect(onReceived).toHaveBeenCalled();
  });
});
