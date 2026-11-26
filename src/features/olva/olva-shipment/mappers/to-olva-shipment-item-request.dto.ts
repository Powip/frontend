import { OLVA_DELIVERY_TYPES } from "../../shared/constants/olva-enums.constants";
import { omitEmptyOlvaValues } from "../../shared/utils/omit-empty-olva-values";
import type {
  OlvaHomeDeliveryDestinationRequestDto,
  OlvaShipmentItemRequestDto,
  OlvaStorePickupDestinationRequestDto,
} from "../dto/olva-shipment-item-request.dto";
import type { CreateOlvaShipmentItemInput } from "../models/create-olva-shipment-input";

/**
 * One shipment -> the part of the body that describes it (single create and bulk items).
 * The backend schemas are strict and reject blank optionals, so every nested block is compacted.
 * Only the known keys are copied: an extra one (like `sender`) would fail the whole request.
 *
 * The delivery type decides the destination: a home delivery sends the ubigeo, address and
 * reference, and store pickup sends the agency only. Fields of the other type are never copied,
 * because the backend refuses an agency with a home delivery and a ubigeo with a store pickup.
 */
export function toOlvaShipmentItemRequestDto(
  input: CreateOlvaShipmentItemInput,
): OlvaShipmentItemRequestDto {
  const common = {
    recipient: omitEmptyOlvaValues(input.recipient) as OlvaShipmentItemRequestDto["recipient"],
    origin: omitEmptyOlvaValues(input.origin) as OlvaShipmentItemRequestDto["origin"],
    package: omitEmptyOlvaValues(input.package) as OlvaShipmentItemRequestDto["package"],
    // A blank order would be rejected: without an order id there is no reference at all
    ...(input.externalRef?.orderId?.trim()
      ? {
          externalRef: omitEmptyOlvaValues(
            input.externalRef,
          ) as OlvaShipmentItemRequestDto["externalRef"],
        }
      : {}),
  };

  if (input.deliveryType === OLVA_DELIVERY_TYPES.HOME_DELIVERY) {
    const { ubigeoCode, address, reference } = input.destination;

    return {
      ...common,
      deliveryType: input.deliveryType,
      // Required for a home delivery: trimmed, never dropped, so a blank fails loudly upstream
      destination: {
        ubigeoCode: ubigeoCode.trim(),
        address: address.trim(),
        reference: reference.trim(),
      } satisfies OlvaHomeDeliveryDestinationRequestDto,
      whoPays: input.whoPays,
      paymentMethod: input.paymentMethod,
    };
  }

  return {
    ...omitEmptyOlvaValues({
      whoPays: input.whoPays,
      deliveryType: input.deliveryType,
      pin: input.pin,
      paymentMethod: input.paymentMethod,
    }),
    ...common,
    destination: {
      agencyCode: input.destination.agencyCode.trim(),
    } satisfies OlvaStorePickupDestinationRequestDto,
  };
}
