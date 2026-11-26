import type {
  OlvaHeadquarter,
  OlvaPaymentMethodOption,
  OlvaPaymentModality,
} from "@/features/olva/olva-catalog/models/olva-headquarter";
import { findOlvaPaymentModality } from "@/features/olva/olva-catalog/utils/find-olva-payment-modality";
import {
  OLVA_PAYMENT_METHODS,
  OLVA_WHO_PAYS_OPTIONS,
  type OlvaPaymentMethod,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE } from "../constants/send-to-olva.constants";

/**
 * Payment methods the provider cannot process right now. PagoEfectivo answers 502 on Olva's side
 * (our API turns it into a 503 PAYMENT_PROVIDER_UNAVAILABLE), so it is not offered. To bring it
 * back, remove it from this list.
 */
export const OLVA_UNAVAILABLE_PAYMENT_METHODS: readonly OlvaPaymentMethod[] = [
  OLVA_PAYMENT_METHODS.PAGOEFECTIVO,
];

export function isOlvaPaymentMethodAvailable(method: OlvaPaymentMethod): boolean {
  return !OLVA_UNAVAILABLE_PAYMENT_METHODS.includes(method);
}

/** Home delivery can only be paid online, so it is available only while online payment is. */
export const isOlvaHomeDeliveryAvailable = (): boolean => SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE;

/** The "who pays" options the user can pick today: ONLINE is left out while it cannot be completed. */
export function filterAvailableOlvaModalities(
  modalities: readonly OlvaPaymentModality[],
): OlvaPaymentModality[] {
  return modalities.filter(
    (modality) =>
      modality.code !== OLVA_WHO_PAYS_OPTIONS.ONLINE || SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE,
  );
}

/** The methods of a modality the user can actually pick today. */
export function filterAvailableOlvaPaymentMethods(
  methods: readonly OlvaPaymentMethodOption[],
): OlvaPaymentMethodOption[] {
  return methods.filter((method) => isOlvaPaymentMethodAvailable(method.code));
}

/** The online methods of the origin headquarter that can be used (home delivery is always paid online). */
export function getOlvaOnlinePaymentMethods(
  headquarter: Pick<OlvaHeadquarter, "paymentModalities"> | undefined,
): OlvaPaymentMethodOption[] {
  if (!SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE) return [];

  const online = headquarter && findOlvaPaymentModality(headquarter, OLVA_WHO_PAYS_OPTIONS.ONLINE);

  return online ? filterAvailableOlvaPaymentMethods(online.paymentMethods) : [];
}

/** The method a home delivery starts with: the only one when there is one, otherwise nothing is chosen for the user. */
export function getDefaultOlvaHomePaymentMethod(
  headquarter: Pick<OlvaHeadquarter, "paymentModalities"> | undefined,
): OlvaPaymentMethod | undefined {
  const methods = getOlvaOnlinePaymentMethods(headquarter);

  return methods.length === 1 ? methods[0]?.code : undefined;
}
