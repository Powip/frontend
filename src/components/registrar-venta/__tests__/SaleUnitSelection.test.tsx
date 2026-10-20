import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { CartItem } from "@/interfaces/IOrder";
import { getSaleUnits } from "@/services/inventoryTrackingService";
import SaleUnitSelection, { UnitAssignmentNotice } from "../SaleUnitSelection";

jest.mock("@/services/inventoryTrackingService", () => ({ ...jest.requireActual("@/services/inventoryTrackingService"), getSaleUnits: jest.fn() }));
const units = [{ id: "a", code: "001234567890123", status: "AVAILABLE" }, { id: "b", code: "001234567890124", status: "RESERVED" }];
const line: CartItem = { id: "line", inventoryItemId: "item", variantId: "variant", sku: "PHONE", productName: "Phone", attributes: { color: "Blue", capacity: "256GB" }, quantity: 1, price: 100, discount: 0, trackingMode: "IMEI" };
const response = { inventoryItemId: "item", variantId: "variant", inventoryId: "warehouse", trackingMode: "IMEI", data: units, meta: { total: 2, totalPages: 1, page: 1, limit: 20 } };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getSaleUnits).mockResolvedValue(response as any); });
function Harness() {
  const [cart, setCart] = useState<CartItem[]>([{ ...line }, { ...line, id: "gift", isGift: true, unitIds: ["b"], units: [units[1] as any] }]);
  return <SaleUnitSelection companyId="company" inventoryId="warehouse" orderId="order" cart={cart} onChange={(id, selected) => setCart((items) => items.map((item) => item.id === id ? { ...item, units: selected, unitIds: selected.map((unit) => unit.id) } : item))} />;
}
test("queries scoped sale inventory, preserves zeroes, reserves own units and excludes another line", async () => {
  render(<Harness />);
  const choices = await screen.findAllByRole("checkbox");
  expect(getSaleUnits).toHaveBeenCalledWith(expect.objectContaining({ variantId: "variant", inventoryId: "warehouse", orderId: "order" }), expect.any(AbortSignal));
  expect(screen.getByText("PHONE · Blue · 256GB")).toBeInTheDocument();
  expect(choices[1]).toBeDisabled();
  fireEvent.click(choices[0]);
  expect(screen.getAllByText("1 de 1 unidades seleccionadas")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Quitar 001234567890123" })).toBeInTheDocument();
  expect(screen.getAllByText("Reservada para esta venta").length).toBeGreaterThan(0);
});
test("ignores a late response from another company and aborts its request", async () => {
  let resolveOld!: (data: any) => void;
  jest.mocked(getSaleUnits).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<SaleUnitSelection companyId="old" inventoryId="warehouse" cart={[line]} onChange={jest.fn()} />);
  await waitFor(() => expect(getSaleUnits).toHaveBeenCalledTimes(1));
  const oldSignal = jest.mocked(getSaleUnits).mock.calls[0][1];
  view.rerender(<SaleUnitSelection companyId="new" inventoryId="warehouse" cart={[line]} onChange={jest.fn()} />);
  await screen.findByRole("checkbox", { name: /001234567890123/ });
  await act(async () => resolveOld({ ...response, data: [{ id: "old", code: "OLD-TENANT", status: "AVAILABLE" }] }));
  expect(oldSignal?.aborted).toBe(true); expect(screen.queryByText("OLD-TENANT")).not.toBeInTheDocument();
});
test("NONE does not query or render additional UI", () => {
  const { container } = render(<SaleUnitSelection companyId="company" inventoryId="warehouse" cart={[{ ...line, trackingMode: "NONE" }]} onChange={jest.fn()} />);
  expect(container).toBeEmptyDOMElement(); expect(getSaleUnits).not.toHaveBeenCalled();
});


test("commercial hold notice distinguishes reserved quantity from assigned units", () => {
  const order = { unitAssignmentStatus: "PENDING_SELECTION" as const, unitCatalogValidated: true, unitStockState: "reserved" as const, stockVersion: 1, confirmedStockVersion: 1 };
  const view = render(<UnitAssignmentNotice order={order} />);
  expect(screen.getByRole("status")).toHaveTextContent("Stock reservado · falta asignar IMEI/serie");
  expect(screen.getByText(/La cantidad ya está reservada/)).toBeInTheDocument();
  expect(screen.queryByText("Unidades confirmadas")).not.toBeInTheDocument();
  view.rerender(<UnitAssignmentNotice order={{ ...order, unitStockState: null }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Stock sin reserva confirmada");
  view.rerender(<UnitAssignmentNotice order={{ ...order, unitAssignmentStatus: "PENDING", stockVersion: 2 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Solicitud de reserva pendiente de confirmación");
  view.rerender(<UnitAssignmentNotice order={{ ...order, unitAssignmentStatus: "REJECTED", unitAssignmentError: "Stock insuficiente" }} />);
  expect(screen.getByRole("status")).toHaveTextContent("No se pudieron reservar las unidades");
  expect(screen.getByText("Stock insuficiente")).toBeInTheDocument();
  view.rerender(<UnitAssignmentNotice order={{ ...order, unitAssignmentStatus: "NONE" }} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
