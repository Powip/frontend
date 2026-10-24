import { buildOrderItem } from "@/app/registrar-venta/orderItemPricing";
import type { CartItem } from "@/interfaces/IOrder";
import { hasConfirmedQuantityHold, unitAssignmentLabel, assignmentBlockReason, requiresAuthenticatedSaleStatusMutation, saleMutationUrl, saleReceiptUrl, persistSaleOperation, readSaleOperation, saleOperationKey, validateSaleUnits } from "../saleTrackingService";
import { GATEWAY } from "@/lib/gateway";

const line: CartItem = { id: "line", inventoryItemId: "item", variantId: "variant", sku: "PHONE", productName: "Phone", quantity: 1, price: 100, discount: 0 };

test("NONE keeps its item payload; tracked IDs change even when variant and quantity stay equal", () => {
  expect(buildOrderItem(line)).not.toHaveProperty("unitIds");
  const a = buildOrderItem({ ...line, trackingMode: "IMEI", unitIds: ["a"] });
  const b = buildOrderItem({ ...line, trackingMode: "IMEI", unitIds: ["b"] });
  expect(a.unitIds).toEqual(["a"]); expect(b.unitIds).toEqual(["b"]);
  expect(a.quantity).toBe(b.quantity); expect(a.productVariantId).toBe(b.productVariantId);
  expect(b).not.toHaveProperty("trackingMode");
});
test("selection requires exact quantity and unique units across gifts and packs", () => {
  expect(validateSaleUnits([line])).toBeNull();
  expect(validateSaleUnits([{ ...line, trackingMode: "IMEI", unitIds: [] }])).toMatch(/exactamente 1/);
  expect(validateSaleUnits([{ ...line, trackingMode: "IMEI", unitIds: ["a"] }, { ...line, trackingMode: "SERIAL", unitIds: ["a"] }])).toMatch(/más de una vez/);
  expect(validateSaleUnits([{ ...line, quantity: 2, trackingMode: "SERIAL", unitIds: ["a", "a"] }])).toMatch(/más de una vez/);
});
test("only current confirmed version can fulfill; historical normal and cancellation preserve flow", () => {
  expect(assignmentBlockReason({}, "PREPARADO")).toBeNull();
  expect(assignmentBlockReason({ unitAssignmentStatus: "UNKNOWN" }, "PREPARADO")).toBeNull();
  expect(assignmentBlockReason({ unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: false, items: [{ trackingMode: "UNKNOWN" }] }, "PREPARADO")).toBeNull();
  expect(assignmentBlockReason({ unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: false, items: [{ trackingMode: "IMEI" }] }, "PREPARADO")).not.toBeNull();
  expect(assignmentBlockReason({ unitAssignmentStatus: "PENDING" }, "PREPARADO")).toMatch(/pendiente/);
  expect(assignmentBlockReason({ unitAssignmentStatus: "REJECTED" }, "ANULADO")).toBeNull();
  expect(assignmentBlockReason({ unitAssignmentStatus: "CONFIRMED", stockVersion: 3, confirmedStockVersion: 2 }, "ENTREGADO")).not.toBeNull();
  expect(assignmentBlockReason({ unitAssignmentStatus: "CONFIRMED", stockVersion: 3, confirmedStockVersion: 3 }, "ENTREGADO")).toBeNull();
});
test("reload recovers exact operation scoped to company/user without credentials", () => {
  const key = saleOperationKey("company", "user");
  const operation = { operationId: "stable", method: "post" as const, url: `${GATEWAY.ventas}/order-header/manual`, payload: { operationId: "stable", items: [{ unitIds: ["a"] }] } };
  persistSaleOperation(key, operation);
  expect(readSaleOperation(key)).toEqual(operation);
  expect(readSaleOperation(saleOperationKey("other", "user"))).toBeNull();
  expect(sessionStorage.getItem(key)).not.toMatch(/token|Bearer/);
  persistSaleOperation(key, null); expect(readSaleOperation(key)).toBeNull();
});

test("tracked and unresolved status mutations use the authenticated route while normal retains its endpoint", () => {
  expect(saleMutationUrl("http://ventas", "normal", { unitAssignmentStatus: "NONE" })).toBe("http://ventas/order-header/normal");
  expect(saleMutationUrl("http://ventas", "tracked", { unitAssignmentStatus: "CONFIRMED" })).toBe("http://ventas/order-header/manual/tracked/status");
  expect(saleMutationUrl("http://ventas", "historical", { unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: false })).toBe("http://ventas/order-header/manual/historical/status");
  expect(saleMutationUrl("http://ventas", "tracked", { items: [{ trackingMode: "IMEI" }] })).toBe("http://ventas/order-header/manual/tracked/status");
});

test("receipt codes are fetched through the scoped manual route for tracked sales", () => {
  expect(saleReceiptUrl("http://ventas", "normal", { unitAssignmentStatus: "NONE" })).toBe("http://ventas/order-header/normal/receipt");
  expect(saleReceiptUrl("http://ventas", "tracked", { unitAssignmentStatus: "CONFIRMED" })).toBe("http://ventas/order-header/manual/tracked/receipt");
});

test("deferred manual preparation uses the authenticated status route without changing receipt or unit safeguards", () => {
  const manual = { status: "PENDIENTE", commercialStage: "SALE" as const, commercialStockState: "DEFERRED" as const, unitAssignmentStatus: "NONE" as const };
  expect(requiresAuthenticatedSaleStatusMutation(manual)).toBe(true);
  expect(saleMutationUrl("http://ventas", "manual", manual)).toBe("http://ventas/order-header/manual/manual/status");
  expect(saleMutationUrl("http://ventas", "manual", { ...manual, status: "PAGADO", externalSource: null })).toBe("http://ventas/order-header/manual/manual/status");
  expect(saleReceiptUrl("http://ventas", "manual", manual)).toBe("http://ventas/order-header/manual/receipt");
  for (const externalSource of ["shopify", "live", "manual", ""]) {
    expect(requiresAuthenticatedSaleStatusMutation({ ...manual, externalSource })).toBe(false);
    expect(saleMutationUrl("http://ventas", "provider", { ...manual, externalSource })).toBe("http://ventas/order-header/provider");
  }
  expect(requiresAuthenticatedSaleStatusMutation({ ...manual, commercialStage: "LEAD" })).toBe(false);
  expect(requiresAuthenticatedSaleStatusMutation({ ...manual, status: "PREPARADO" })).toBe(false);
  expect(assignmentBlockReason({ ...manual, unitAssignmentStatus: "PENDING", hasTrackedUnits: true }, "PREPARADO")).toMatch(/pendiente/);
});


const quantityHold = { unitAssignmentStatus: "PENDING_SELECTION" as const, unitCatalogValidated: true, unitStockState: "reserved" as const, stockVersion: 2, confirmedStockVersion: 2, items: [{ trackingMode: "IMEI" }, { trackingMode: "NONE" }] };
test("quantity-only hold is labelled as reserved but cannot prepare, dispatch or deliver", () => {
  expect(hasConfirmedQuantityHold(quantityHold)).toBe(true);
  expect(unitAssignmentLabel(quantityHold)).toBe("Stock reservado · falta asignar IMEI/serie");
  for (const status of ["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO"]) {
    expect(assignmentBlockReason(quantityHold, status)).toContain("falta asignar IMEI/serie");
  }
  expect(assignmentBlockReason(quantityHold, "PENDIENTE")).toBeNull();
  expect(validateSaleUnits([{ trackingMode: "IMEI", quantity: 2, unitIds: [] }, { trackingMode: "NONE", quantity: 3 }])).toContain("exactamente 2");
});
test.each([
  { unitStockState: null }, { confirmedStockVersion: 1 }, { stockVersion: 0, confirmedStockVersion: 0 },
  { unitCatalogValidated: false }, { unitAssignmentStatus: "PENDING" as const }, { unitAssignmentStatus: "REJECTED" as const },
])("incomplete or unacknowledged hold never announces reserved stock: %j", (patch) => {
  const order = { ...quantityHold, ...patch };
  expect(hasConfirmedQuantityHold(order)).toBe(false);
  expect(unitAssignmentLabel(order)).not.toBe("Stock reservado · falta asignar IMEI/serie");
  expect(assignmentBlockReason(order, "EN_ENVIO")).not.toBeNull();
});
test("a later unit-assignment acknowledgement is required before fulfilling the held quantity", () => {
  const selecting = { ...quantityHold, stockVersion: 3, unitAssignmentStatus: "PENDING" as const };
  expect(assignmentBlockReason(selecting, "PREPARADO")).not.toBeNull();
  const confirmed = { ...selecting, confirmedStockVersion: 3, unitAssignmentStatus: "CONFIRMED" as const };
  expect(unitAssignmentLabel(confirmed)).toBe("Unidades confirmadas");
  expect(assignmentBlockReason(confirmed, "PREPARADO")).toBeNull();
  expect(unitAssignmentLabel({ unitAssignmentStatus: "NONE", unitStockState: "reserved" })).toBeNull();
});
