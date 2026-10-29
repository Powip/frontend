import { canCompleteCustomerServicePurchaseData, canConfirmCustomerServicePurchase, canManageCustomerServiceOrder, isCustomerServicePurchasePending } from "../customerServiceOrderAccess";
import type { OrderHeader } from "@/interfaces/IOrder";

it.each([
  [["MANAGE_CUSTOMER_SERVICE"], "shopify_cod", true],
  [["MANAGE_CUSTOMER_SERVICE"], "manual", true],
  [["CONFIRM_SALE"], "shopify_cod", true],
  [["CONFIRM_SALE"], "manual", false],
  [["CONFIRM_SALE"], null, false],
  [["VIEW_CUSTOMER_SERVICE"], "shopify_cod", false],
  [[], "shopify_cod", false],
])("checks actual grants %j for channel %s", (permissions, channel, expected) => {
  const hasPermission = (permission: string) => permissions.includes(permission);
  expect(canManageCustomerServiceOrder(hasPermission, channel)).toBe(expected);
});

it("recognizes an unconfirmed legacy manual CC order without requiring an explicit commercial lead", () => {
  const legacy: Partial<OrderHeader> = { status: "PENDIENTE", externalSource: null, subEstadoCc: "entrega_lima", commercialStage: null };
  expect(isCustomerServicePurchasePending(legacy)).toBe(true);
  for (const confirmed of [
    { commercialStage: "SALE" }, { commercialCommittedAt: "2026-10-27T12:00:00Z" },
    { ccConfirmadoAt: "2026-10-27T12:00:00Z" }, { status: "PREPARADO" }, { status: "ANULADO" },
    { subEstadoCc: "anulado_cc" }, { subEstadoCc: "confirmado" },
  ] as Partial<OrderHeader>[]) expect(isCustomerServicePurchasePending({ ...legacy, ...confirmed })).toBe(false);
  expect(canCompleteCustomerServicePurchaseData(legacy)).toBe(true);
  const lost = { ...legacy, commercialStage: "LEAD", commercialLead: { status: "PERDIDO" } } as Partial<OrderHeader>;
  expect(isCustomerServicePurchasePending(lost)).toBe(true); // Preserve the Lead detail layout.
  expect(canCompleteCustomerServicePurchaseData(lost)).toBe(false);
});

it.each([
  [["CONFIRM_SALE"], "manual", true],
  [["CONFIRM_SALE"], null, true],
  [["EDIT_SALE"], "manual", false],
  [["CREATE_SALE", "VIEW_CUSTOMER_SERVICE"], "manual", false],
  [["MANAGE_CUSTOMER_SERVICE"], "manual", false],
  [["MANAGE_CUSTOMER_SERVICE"], "shopify_cod", true],
  [["CONFIRM_SALE"], "shopify_cod", true],
])("keeps purchase confirmation separate from CC management for grants %j and channel %s", (permissions, channel, expected) => {
  expect(canConfirmCustomerServicePurchase(permission => permissions.includes(permission), channel)).toBe(expected);
});
