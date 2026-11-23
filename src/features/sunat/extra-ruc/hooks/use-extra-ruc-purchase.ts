import { useQuery } from "@tanstack/react-query";
import { getExtraRucPurchaseApi } from "../api/extra-ruc.api";
import { extraRucKeys } from "../keys/extra-ruc.keys";
import type { ExtraRucPurchase } from "../models/extra-ruc";

export const PURCHASE_POLL_MS = 3_000;

/** Estado de una compra. Se vuelve a consultar cada 3 s mientras siga PENDING (el pago lo confirma el webhook). */
export function useExtraRucPurchase(purchaseId: string | null) {
  return useQuery<ExtraRucPurchase, Error>({
    queryKey: extraRucKeys.purchase(purchaseId ?? "none"),
    queryFn: () => getExtraRucPurchaseApi(purchaseId as string),
    enabled: purchaseId !== null,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? PURCHASE_POLL_MS : false),
  });
}
