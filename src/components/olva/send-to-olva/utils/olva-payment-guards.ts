import type {
  OlvaNiubizPayment,
  OlvaPagoEfectivoPayment,
  OlvaShipmentPayment,
} from "@/features/olva/olva-shipment/models/olva-shipment";
import { OLVA_PAYMENT_METHODS } from "@/features/olva/shared/constants/olva-enums.constants";

// `OlvaOtherPayment.method` is a plain string, so `payment.method === ...` does not narrow the union
export const isOlvaPagoEfectivoPayment = (
  payment: OlvaShipmentPayment,
): payment is OlvaPagoEfectivoPayment => payment.method === OLVA_PAYMENT_METHODS.PAGOEFECTIVO;

export const isOlvaNiubizPayment = (payment: OlvaShipmentPayment): payment is OlvaNiubizPayment =>
  payment.method === OLVA_PAYMENT_METHODS.NIUBIZ;
