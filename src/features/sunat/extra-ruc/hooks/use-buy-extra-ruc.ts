import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { buyExtraRucApi } from "../api/extra-ruc.api";
import type { BuyExtraRucInput, ExtraRucPurchase } from "../models/extra-ruc";

/**
 * Crea la compra de un RUC extra. Quien llama redirige a redirectUrl (la página de pago de Flow); los errores
 * (p. ej. NO_FLOW_PLAN) los maneja el que llama, porque cada pantalla reacciona distinto.
 */
export function useBuyExtraRuc(): UseMutationResult<ExtraRucPurchase, Error, BuyExtraRucInput> {
  return useMutation({ mutationFn: buyExtraRucApi });
}
