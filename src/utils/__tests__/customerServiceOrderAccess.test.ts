import { canManageCustomerServiceOrder } from "../customerServiceOrderAccess";

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
