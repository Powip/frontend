import { fireEvent, render, screen } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";
import SaleUnitLifecycleForm, { lifecycleCart, lifecycleSelectionError } from "../SaleUnitLifecycleForm";

const order = {
  id: "order", stockVersion: 3, status: "ENTREGADO", items: [
    { id: "phone-line", productVariantId: "phone", sku: "PHONE", productName: "Teléfono", trackingMode: "IMEI", quantity: 1, unitPrice: "100", unitIds: ["unit-a"], units: [{ id: "unit-a", code: "001234567890123", status: "SOLD" }] },
    { id: "case-line", productVariantId: "case", sku: "CASE", productName: "Funda", trackingMode: "NONE", quantity: 2, unitPrice: "10" },
  ],
} as OrderHeader;

function accept() {
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Cliente devolvió la compra" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

test("complete return shows authorized codes and fixed normal quantities and requires physical confirmation", () => {
  const confirm = jest.fn();
  render(<SaleUnitLifecycleForm action="return" companyId="company" order={order} cart={lifecycleCart(order)} onConfirm={confirm} />);
  expect(screen.getByText("001234567890123")).toBeInTheDocument();
  expect(screen.getByText("Cantidad completa: 2")).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Confirmar devolución completa" });
  expect(button).toBeDisabled(); accept(); fireEvent.click(button);
  expect(confirm).toHaveBeenCalledWith({ reason: "Cliente devolvió la compra", items: [{ orderItemId: "phone-line", quantity: 1, unitIds: ["unit-a"] }, { orderItemId: "case-line", quantity: 2 }] });
});

test("return cannot proceed if snapshot contains a missing or already released unit", () => {
  const invalid = { ...order, items: order.items.map((item, index) => index ? item : { ...item, units: [{ id: "unit-a", code: "001234567890123", status: "AVAILABLE" as const }] }) };
  expect(lifecycleSelectionError("return", invalid, lifecycleCart(invalid))).toMatch(/entrega completa/);
});

test("reactivation never auto selects prior units and preserves exact variants and quantities", () => {
  const cart = lifecycleCart(order);
  expect(cart[0].unitIds).toEqual([]);
  expect(lifecycleSelectionError("reactivate", order, cart)).toMatch(/exactamente 1/);
  cart[0].unitIds = ["unit-b"];
  expect(lifecycleSelectionError("reactivate", order, cart)).toBeNull();
  cart[1].quantity = 1;
  expect(lifecycleSelectionError("reactivate", order, cart)).toMatch(/conservar/);
});

test("reactivation rejects one unit chosen across multiple lines", () => {
  const repeated = { ...order, items: [order.items[0], { ...order.items[0], id: "other-line" }] };
  const cart = lifecycleCart(repeated).map((line) => ({ ...line, unitIds: ["unit-a"] }));
  expect(lifecycleSelectionError("reactivate", repeated, cart)).toMatch(/más de una vez/);
});

test("changing company clears the physical confirmation and reason", () => {
  const confirm = jest.fn();
  const props = { action: "return" as const, order, cart: lifecycleCart(order), onConfirm: confirm };
  const { rerender } = render(<SaleUnitLifecycleForm {...props} companyId="company-a" />);
  accept();
  rerender(<SaleUnitLifecycleForm {...props} companyId="company-b" />);
  expect(screen.getByLabelText("Motivo")).toHaveValue("");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Confirmar devolución completa" })).toBeDisabled();
});


const inTransitOrder: OrderHeader = { ...order, status: "EN_ENVIO", items: order.items.map((item, i) => i ? item : { ...item, units: [{ id: "unit-a", code: "001234567890123", status: "RESERVED" }] }) };

test("in-transit return requires both physical receipt and a reason, including the fixed NONE quantity", () => {
  const confirm = jest.fn();
  render(<SaleUnitLifecycleForm action="return" companyId="company" order={inTransitOrder} cart={lifecycleCart(inTransitOrder)} onConfirm={confirm} />);
  expect(screen.getByText(/el pedido seguirá En envío/)).toBeInTheDocument();
  expect(screen.getByText("Cantidad completa: 2")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Unidades en envío PHONE" })).toHaveTextContent("001234567890123 · En envío / Reservada");
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Confirmar retorno físico" });
  fireEvent.click(button);
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: /TODOS los productos de este pedido/ }));
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "   " } });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Courier devolvió todo" } });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledWith({ reason: "Courier devolvió todo", physicalReturnConfirmed: true, items: [{ orderItemId: "phone-line", quantity: 1, unitIds: ["unit-a"] }, { orderItemId: "case-line", quantity: 2 }] });
});

test.each(["AVAILABLE", "SOLD"] as const)("in-transit return rejects a %s unit instead of releasing an unrelated snapshot", (status) => {
  const invalid = { ...inTransitOrder, items: inTransitOrder.items.map((item, i) => i ? item : { ...item, units: [{ id: "unit-a", code: "001234567890123", status }] }) };
  expect(lifecycleSelectionError("return", invalid, lifecycleCart(invalid))).toMatch(/reserva completa/);
});

test("delivered returns still require SOLD and unsupported states cannot use the physical return form", () => {
  const delivered = { ...inTransitOrder, status: "ENTREGADO" as const };
  expect(lifecycleSelectionError("return", delivered, lifecycleCart(delivered))).toMatch(/entrega completa/);
  const pending = { ...inTransitOrder, status: "PENDIENTE" as const };
  expect(lifecycleSelectionError("return", pending, lifecycleCart(pending))).toMatch(/comprobar si permite/);
});

test("a new status clears physical confirmation even when the stock version remains unchanged", () => {
  const props = { action: "return" as const, companyId: "company", onConfirm: jest.fn() };
  const { rerender } = render(<SaleUnitLifecycleForm {...props} order={inTransitOrder} cart={lifecycleCart(inTransitOrder)} />);
  accept();
  rerender(<SaleUnitLifecycleForm {...props} order={order} cart={lifecycleCart(order)} />);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByLabelText("Motivo")).toHaveValue("");
});
