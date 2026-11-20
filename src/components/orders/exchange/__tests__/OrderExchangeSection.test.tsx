/**
 * FEAT-24 H12 (H12-D2) — cambio de producto en el detalle del pedido: botón solo para despachado o
 * entregado, líneas que se pueden cambiar, clave de idempotencia estable entre reintentos, 409 con su
 * mensaje, enlace al pedido de cambio, historial y la etiqueta «Cambio de ORD-xxxx».
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { OrderExchangeSection } from "@/components/orders/exchange/OrderExchangeSection";
import { ExchangeOrderTag } from "@/components/orders/exchange/ExchangeOrderTag";
import { canExchangeOrder, exchangeableLines } from "@/lib/orderExchange";
import { createOrderExchange, listOrderExchanges, type OrderExchange } from "@/services/orderExchangeService";
import { searchReconciliationVariants } from "@/services/reconciliationTask.service";
import type { OrderItem } from "@/interfaces/IOrder";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", email: "cc@tienda.pe", role: "ATENCION" }, company: { id: "c1" } } }),
}));
jest.mock("@/services/orderExchangeService", () => ({ createOrderExchange: jest.fn(), listOrderExchanges: jest.fn() }));
jest.mock("@/services/reconciliationTask.service", () => ({ searchReconciliationVariants: jest.fn() }));
jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: ({ orderId }: { orderId: string }) => <div role="dialog" aria-label="Detalle anidado">Detalle de {orderId}</div>,
}));

const item = (id: string, patch: Partial<OrderItem> = {}): OrderItem => ({
  id, productVariantId: `v-${id}`, sku: `SKU-${id}`, productName: `Producto ${id}`, attributes: {}, quantity: 2, unitPrice: "50",
  subtotal: "100", discountType: "NONE", discountAmount: "0", created_at: "", updated_at: "", trackingMode: "NONE", ...patch,
});

const ORDER = {
  id: "o-1",
  orderNumber: "ORD-157001",
  status: "ENTREGADO" as const,
  items: [
    item("polo", { productName: "Polo", attributes: { Talla: "M" } }),
    item("kit", { productName: "Kit", packComponents: [{ variantId: "v-a", quantity: 1 }] }),
    item("cel", { productName: "Celular", trackingMode: "IMEI" }),
    item("gorra", { productName: "Gorra", quantity: 1, exchangedQuantity: 1 }),
  ],
};

const EXCHANGE: OrderExchange = {
  exchangeId: "ex-1", status: "aplicado", orderId: "o-1", childOrderId: "o-2", childOrderNumber: "ORD-157050", returnReceptionId: "rec-9",
  priceDifference: 10, reason: "Talla equivocada", createdAt: "2026-11-18T15:00:00.000Z", appliedAt: "2026-11-18T15:00:05.000Z",
  lines: [{ itemId: "polo", variantId: "v-polo", sku: "SKU-polo", productName: "Polo", newVariantId: "v-polo-l", newSku: "POL-L", newProductName: "Polo L", quantity: 1, unitPrice: 10 }],
};

const httpError = (status: number | null, message = "") =>
  new AxiosError(message || "Network Error", status ? "ERR_BAD_RESPONSE" : "ERR_NETWORK", undefined, undefined,
    status ? { status, statusText: "", data: { message }, headers: {}, config: { headers: new AxiosHeaders() } } : undefined);

function renderSection(order: Parameters<typeof OrderExchangeSection>[0]["order"] = ORDER, canManage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChanged = jest.fn();
  render(<QueryClientProvider client={client}><OrderExchangeSection order={order} canManage={canManage} onChanged={onChanged} /></QueryClientProvider>);
  return { onChanged };
}

async function fillDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Cambiar producto" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("radio", { name: /Polo · M/ }));
  await user.type(within(dialog).getByLabelText("Producto nuevo"), "polo");
  await user.click(await within(dialog).findByRole("button", { name: /Polo · L/ }));
  await user.type(within(dialog).getByLabelText(/^Motivo/), "Talla equivocada");
  return dialog;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listOrderExchanges).mockResolvedValue([]);
  jest.mocked(searchReconciliationVariants).mockResolvedValue([
    { variant_id: "v-polo-l", product_name: "Polo", sku: "POL-L", company_sku: "POL-L", attribute_values: { Talla: "L" }, product_type: "variantes", tracking_mode: "NONE" },
  ]);
});

describe("reglas", () => {
  it("solo un pedido despachado o entregado (y no de Live) admite el cambio", () => {
    expect(canExchangeOrder({ status: "DESPACHADO" })).toBe(true);
    expect(canExchangeOrder({ status: "ENTREGADO" })).toBe(true);
    for (const status of ["PENDIENTE", "PREPARADO", "EN_ENVIO", "ANULADO"]) expect(canExchangeOrder({ status })).toBe(false);
    expect(canExchangeOrder({ status: "ENTREGADO", externalSource: "POWIP_LIVE" })).toBe(false);
  });

  it("no ofrece packs, productos con IMEI o serie, ni líneas ya cambiadas del todo", () => {
    expect(exchangeableLines(ORDER.items).map((line) => [line.itemId, line.remaining])).toEqual([["polo", 2]]);
  });
});

describe("botón y diálogo", () => {
  it("no muestra «Cambiar producto» si el pedido no salió o sin permiso de Atención al cliente", async () => {
    renderSection({ ...ORDER, status: "PREPARADO" });
    await waitFor(() => expect(listOrderExchanges).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Cambiar producto" })).not.toBeInTheDocument();
  });

  it("sin permiso ni historial no dibuja nada ni consulta", () => {
    renderSection(ORDER, false);
    expect(screen.queryByRole("button", { name: "Cambiar producto" })).not.toBeInTheDocument();
    expect(listOrderExchanges).not.toHaveBeenCalled();
  });

  it("reintenta con la misma clave si no hubo respuesta; tras un 409 muestra el mensaje y usa otra clave", async () => {
    jest.mocked(createOrderExchange)
      .mockRejectedValueOnce(httpError(null))
      .mockRejectedValueOnce(httpError(409, "La línea del pedido ya no admite ese cambio (se cambió o se editó)."))
      .mockResolvedValueOnce(EXCHANGE);
    const user = userEvent.setup();
    const { onChanged } = renderSection();
    const dialog = await fillDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Registrar cambio" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No pudimos confirmar si el cambio se registró");
    // Sin respuesta: los datos quedan fijos para que el reintento sea el mismo cambio.
    expect(within(dialog).getByLabelText("Unidades")).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Reintentar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("La línea del pedido ya no admite ese cambio");
    expect(within(dialog).getByLabelText("Unidades")).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Registrar cambio" }));

    await within(dialog).findByText("Cambio registrado");
    const calls = jest.mocked(createOrderExchange).mock.calls;
    expect(calls[0][0]).toBe("o-1");
    expect(calls[0][1]).toEqual({ lines: [{ itemId: "polo", newVariantId: "v-polo-l", quantity: 1 }], reason: "Talla equivocada" });
    expect(calls[1][2]).toBe(calls[0][2]);
    expect(calls[2][2]).not.toBe(calls[1][2]);
    expect(onChanged).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Ver pedido de cambio ORD-157050" }));
    expect(await screen.findByRole("dialog", { name: "Detalle anidado" })).toHaveTextContent("Detalle de o-2");
  });

  it("no deja pedir más unidades de las que quedan por cambiar", async () => {
    const user = userEvent.setup();
    renderSection();
    const dialog = await fillDialog(user);
    await user.clear(within(dialog).getByLabelText("Unidades"));
    await user.type(within(dialog).getByLabelText("Unidades"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Registrar cambio" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("La cantidad va de 1 a 2.");
    expect(createOrderExchange).not.toHaveBeenCalled();
  });
});

describe("historial y etiqueta", () => {
  it("muestra el historial de cambios con el enlace al pedido de cambio", async () => {
    jest.mocked(listOrderExchanges).mockResolvedValue([EXCHANGE]);
    renderSection({ ...ORDER, status: "PENDIENTE" });
    const history = await screen.findByRole("list", { name: "Cambios de producto" });
    expect(history).toHaveTextContent("1 × Polo → Polo L");
    expect(history).toHaveTextContent("Diferencia a cobrar: S/ 10.00");
    expect(history).toHaveTextContent("Motivo: Talla equivocada");
    expect(within(history).getByRole("button", { name: "Ver pedido de cambio ORD-157050" })).toBeInTheDocument();
  });

  it("el pedido hijo lleva «Cambio de ORD-xxxx»; uno normal no lleva etiqueta", () => {
    const { rerender } = render(<ExchangeOrderTag order={{ orderType: "CAMBIO", parentOrderNumber: "ORD-157001" }} />);
    expect(screen.getByTestId("exchange-order-tag")).toHaveTextContent("Cambio de ORD-157001");
    rerender(<ExchangeOrderTag order={{ orderType: "VENTA", parentOrderNumber: null }} />);
    expect(screen.queryByTestId("exchange-order-tag")).not.toBeInTheDocument();
  });
});
