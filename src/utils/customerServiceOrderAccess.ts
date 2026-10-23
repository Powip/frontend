/** Match the existing Shopify COD confirmation authority without granting other channels. */
export function canManageCustomerServiceOrder(
  hasPermission: (permission: string) => boolean,
  canalOrigen?: string | null,
): boolean {
  return (
    hasPermission("MANAGE_CUSTOMER_SERVICE") ||
    (canalOrigen === "shopify_cod" && hasPermission("CONFIRM_SALE"))
  );
}
