import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  getSaleUnitLifecycleContext,
  lifecycleStorageKey,
  persistLifecycleOperation,
  readLifecycleOperation,
  resolveSaleLifecycleTransition,
  saleLifecycleTransition,
  submitSaleUnitLifecycle,
} from "../saleUnitLifecycleService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});
test("authenticated routes send the exact version and item IDs without client tenant or actor fields", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: { orderId: "order" } });
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: "order" } });
  const signal = new AbortController().signal;
  await getSaleUnitLifecycleContext("order", signal);
  const request = {
    operationId: "uuid",
    expectedStockVersion: 0,
    reason: "Reactivar",
    items: [
      { orderItemId: "normal", quantity: 2 },
      { orderItemId: "tracked", quantity: 1, unitIds: ["unit"] },
    ],
  };
  await submitSaleUnitLifecycle("order", "reactivate", request);
  expect(axiosAuth.get).toHaveBeenCalledWith(
    `${GATEWAY.ventas}/order-header/manual/order/unit-lifecycle/context`,
    { signal },
  );
  expect(axiosAuth.post).toHaveBeenCalledWith(
    `${GATEWAY.ventas}/order-header/manual/order/unit-stock/reactivate`,
    request,
  );
  expect(request).not.toHaveProperty("companyId");
  expect(request.items[0]).not.toHaveProperty("unitIds");
});
test("recovery persists exact request under company/user/order and rejects a mismatched identity", () => {
  const key = lifecycleStorageKey("company", "user", "order");
  const operation = {
    orderId: "order",
    kind: "return" as const,
    operationId: "uuid",
    request: {
      operationId: "uuid",
      expectedStockVersion: 5,
      reason: "Devolver",
      items: [{ orderItemId: "line", quantity: 1, unitIds: ["unit"] }],
    },
  };
  persistLifecycleOperation(key, operation);
  expect(readLifecycleOperation(key, "order")).toEqual(operation);
  expect(readLifecycleOperation(lifecycleStorageKey("other", "user", "order"), "order")).toBeNull();
  expect(readLifecycleOperation(key, "other-order")).toBeNull();
  sessionStorage.setItem(
    key,
    JSON.stringify({ ...operation, request: { ...operation.request, operationId: "different" } }),
  );
  expect(readLifecycleOperation(key, "order")).toBeNull();
});
test("only tracked terminal transitions use the lifecycle flow; normal handlers remain unchanged", () => {
  expect(
    saleLifecycleTransition({ status: "ENTREGADO", unitAssignmentStatus: "NONE" }, "ANULADO"),
  ).toBeNull();
  expect(
    saleLifecycleTransition({ status: "ANULADO", unitAssignmentStatus: "NONE" }, "PENDIENTE"),
  ).toBeNull();
  expect(
    saleLifecycleTransition({ status: "ENTREGADO", unitAssignmentStatus: "CONFIRMED" }, "ANULADO"),
  ).toBe("return");
  expect(
    saleLifecycleTransition({ status: "ANULADO", unitAssignmentStatus: "CONFIRMED" }, "PENDIENTE"),
  ).toBe("reactivate");
  expect(
    saleLifecycleTransition({ status: "EN_ENVIO", unitAssignmentStatus: "CONFIRMED" }, "ANULADO"),
  ).toBe("return");
  expect(saleLifecycleTransition({ status: "EN_ENVIO", unitAssignmentStatus: "NONE" }, "ANULADO")).toBeNull();
});

test("historical UNKNOWN resolves silently to NONE while known NONE never adds a request", async () => {
  const historical = {
    id: "order",
    status: "ANULADO",
    unitAssignmentStatus: "PENDING_SELECTION" as const,
    unitCatalogValidated: false,
  };
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({
      data: {
        orderId: "order",
        status: "ANULADO",
        items: [{ trackingMode: "NONE" }],
        canReactivate: false,
      },
    });
  await expect(resolveSaleLifecycleTransition(historical, "PENDIENTE")).resolves.toBeNull();
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  jest.clearAllMocks();
  await expect(
    resolveSaleLifecycleTransition(
      { ...historical, unitAssignmentStatus: "NONE", unitCatalogValidated: true },
      "PENDIENTE",
    ),
  ).resolves.toBeNull();
  expect(axiosAuth.get).not.toHaveBeenCalled();
});
test("historical tracked context opens explicit selection and unverifiable context never falls through", async () => {
  const historical = {
    id: "order",
    status: "ANULADO",
    unitAssignmentStatus: "UNKNOWN" as const,
    unitCatalogValidated: false,
  };
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({
      data: { orderId: "order", status: "ANULADO", items: [{ trackingMode: "IMEI" }] },
    });
  await expect(resolveSaleLifecycleTransition(historical, "PENDIENTE")).resolves.toBe("reactivate");
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({
      data: { orderId: "order", status: "ANULADO", items: [{ trackingMode: "UNKNOWN" }] },
    });
  await expect(resolveSaleLifecycleTransition(historical, "PENDIENTE")).rejects.toThrow(
    "No se pudo validar",
  );
  jest.mocked(axiosAuth.get).mockRejectedValue(new Error("unavailable"));
  await expect(resolveSaleLifecycleTransition(historical, "PENDIENTE")).rejects.toThrow(
    "unavailable",
  );
});


test.each(["SERIAL", "IMEI", "NONE"])("EN_ENVIO UNKNOWN consults the authoritative %s context before cancellation", async (trackingMode) => {
  const order = { id: "order", status: "EN_ENVIO", unitAssignmentStatus: "UNKNOWN" as const, unitCatalogValidated: false };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: { orderId: "order", status: "EN_ENVIO", items: [{ trackingMode }] } });
  await expect(resolveSaleLifecycleTransition(order, "ANULADO")).resolves.toBe(trackingMode === "NONE" ? null : "return");
  expect(axiosAuth.get).toHaveBeenCalledWith(`${GATEWAY.ventas}/order-header/manual/order/unit-lifecycle/context`, { signal: undefined });
});

test("in-transit cancellation fails closed on a different order or an outdated status", async () => {
  const order = { id: "order", status: "EN_ENVIO", unitAssignmentStatus: "UNKNOWN" as const };
  for (const context of [{ orderId: "foreign", status: "EN_ENVIO" }, { orderId: "order", status: "ENTREGADO" }]) {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { ...context, items: [{ trackingMode: "NONE" }] } });
    await expect(resolveSaleLifecycleTransition(order, "ANULADO")).rejects.toThrow("No se pudo validar");
  }
});

test("known NONE in transit continues its original action without a context request", async () => {
  await expect(resolveSaleLifecycleTransition({ id: "order", status: "EN_ENVIO", unitAssignmentStatus: "NONE", unitCatalogValidated: true, items: [{ trackingMode: "NONE" }] }, "ANULADO")).resolves.toBeNull();
  expect(axiosAuth.get).not.toHaveBeenCalled();
});

test("physical confirmation survives exact recovery and only goes to the authenticated return endpoint", async () => {
  const key = lifecycleStorageKey("company", "user", "order");
  const request = { operationId: "uuid", expectedStockVersion: 2, reason: "Productos recibidos", physicalReturnConfirmed: true, items: [{ orderItemId: "tracked", quantity: 1, unitIds: ["unit"] }, { orderItemId: "normal", quantity: 2 }] };
  persistLifecycleOperation(key, { orderId: "order", kind: "return", operationId: request.operationId, request });
  const restored = readLifecycleOperation(key, "order")!;
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { id: "order" } });
  await submitSaleUnitLifecycle("order", "return", restored.request!);
  expect(axiosAuth.post).toHaveBeenCalledWith(`${GATEWAY.ventas}/order-header/manual/order/unit-stock/return`, request);
  expect(request).not.toHaveProperty("returnFromReserved");
});
