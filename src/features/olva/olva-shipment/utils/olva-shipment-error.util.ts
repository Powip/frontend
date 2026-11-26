import { getOlvaErrorMessage } from "../../shared/utils/olva-error.util";
import { OLVA_SHIPMENT_ERROR_CODES } from "../constants/olva-shipment-error-codes.constants";

export const OLVA_SHIPMENT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [OLVA_SHIPMENT_ERROR_CODES.ALREADY_EXISTS]: "Este pedido ya tiene un envío de Olva activo.",
  [OLVA_SHIPMENT_ERROR_CODES.ORIGIN_NOT_FOUND]:
    "La sede de origen no existe en Olva. Elige otra e intenta de nuevo.",
  [OLVA_SHIPMENT_ERROR_CODES.ORIGIN_DOES_NOT_ACCEPT_PAYMENT]:
    "La sede de origen no acepta esa forma de pago. Elige otra forma de pago.",
  [OLVA_SHIPMENT_ERROR_CODES.DESTINATION_UBIGEO_NOT_FOUND]:
    "El ubigeo de destino no existe en Olva. Elige otro distrito e intenta de nuevo.",
  [OLVA_SHIPMENT_ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE]:
    "El medio de pago no está disponible por ahora. Elige pago con tarjeta (Niubiz) o intenta de nuevo en unos minutos.",
  [OLVA_SHIPMENT_ERROR_CODES.NOT_PERSISTED]:
    "Olva registró el envío, pero no pudimos guardarlo. No lo envíes de nuevo: contacta a soporte.",
  // REJECTED_BY_OLVA has no fixed text on purpose: its `message` already carries Olva's own
  // reason ("reason: detail"), and a generic sentence here would hide it from the user
};

/** Message for any error of a shipment call: shipment codes first, then the generic Olva ones. */
export function getOlvaShipmentErrorMessage(error: unknown): string {
  return getOlvaErrorMessage(error, OLVA_SHIPMENT_ERROR_MESSAGES);
}
