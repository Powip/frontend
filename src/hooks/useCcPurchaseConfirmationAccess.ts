import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { canConfirmCustomerServicePurchase } from "@/utils/customerServiceOrderAccess";
import { getCommercialLeadConfirmationCapabilities } from "@/services/commercialLeadsService";
import { getCcOrderConfirmationCapabilities } from "@/services/atencionClienteService";

/** Shared server authority for confirming a purchase and completing its customer data. */
export function useCcPurchaseConfirmationAccess(
  orderId: string,
  canalOrigen?: string | null,
  enabled = true,
) {
  const { auth, hasPermission } = useAuth();
  const companyId = auth?.company?.id;
  const userId = auth?.user?.id;
  const isShopifyCod = canalOrigen === "shopify_cod";
  const canRequestConfirmation = canConfirmCustomerServicePurchase(hasPermission, canalOrigen);
  const capabilities = useQuery({
    queryKey: ["cc-sale-confirmation-capabilities", companyId, userId, isShopifyCod ? orderId : null],
    queryFn: () => isShopifyCod
      ? getCcOrderConfirmationCapabilities(orderId)
      : getCommercialLeadConfirmationCapabilities(),
    enabled: enabled && canRequestConfirmation && !!companyId && !!userId,
    retry: false,
  });
  return {
    capabilities,
    canRequestConfirmation,
    canConfirm: canRequestConfirmation && capabilities.isSuccess &&
      capabilities.data.enabled === true && capabilities.data.canConfirm,
  };
}
