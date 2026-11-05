import type { OlvaAgency } from "@/features/olva/olva-agency/models/olva-agency";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import type { OlvaStandardSize } from "@/features/olva/olva-catalog/models/olva-standard-size";
import type { OlvaQuoteInput } from "@/features/olva/olva-quote/models/olva-quote-input";
import { OLVA_UBIGEO_CODE_LENGTH } from "@/features/olva/olva-shipment/constants/olva-shipment.constants";
import {
  OLVA_DELIVERY_TYPES,
  OLVA_QUOTE_SHIPMENT_TYPES,
  type OlvaDeliveryType,
} from "@/features/olva/shared/constants/olva-enums.constants";

interface DestinationUbigeoParams {
  deliveryType: OlvaDeliveryType | undefined;
  /** Home delivery: the 6-digit ubigeo of the district the user picked. */
  ubigeoCode: string | undefined;
  /** Store pickup: the agency the user picked (its detail carries the ubigeo). */
  agency: Pick<OlvaAgency, "ubigeo"> | undefined;
}

/**
 * The ubigeo a shipment is priced to: the picked district for a home delivery, the agency's own
 * for a store pickup. `undefined` while it is not known yet (or, for a home delivery, while the
 * code is still incomplete), so the quote stays idle instead of asking Olva with a half value.
 */
export function getOlvaDestinationUbigeo({
  deliveryType,
  ubigeoCode,
  agency,
}: DestinationUbigeoParams): string | undefined {
  if (deliveryType === OLVA_DELIVERY_TYPES.HOME_DELIVERY) {
    return ubigeoCode?.length === OLVA_UBIGEO_CODE_LENGTH ? ubigeoCode : undefined;
  }

  return agency?.ubigeo || undefined;
}

interface BuildOlvaQuoteInputParams {
  headquarter: Pick<OlvaHeadquarter, "ubigeoCode"> | undefined;
  /** See `getOlvaDestinationUbigeo`. */
  destinationUbigeo: string | undefined;
  deliveryType: OlvaDeliveryType | undefined;
  weightKg: unknown;
  /** The size the shipment goes in (picked, or the one Olva would choose for the weight). */
  size: Pick<OlvaStandardSize, "lengthCm" | "widthCm" | "heightCm"> | undefined;
}

/**
 * The quote request for one order, or `null` while something it needs is still missing.
 *
 * Olva prices a box by its measures (and refuses a parcel quote without them, with a 422), so the
 * size is needed before asking. The envelope has no measures: it is priced as a document.
 */
export function buildOlvaQuoteInput({
  headquarter,
  destinationUbigeo,
  deliveryType,
  weightKg,
  size,
}: BuildOlvaQuoteInputParams): OlvaQuoteInput | null {
  const weight = Number(weightKg);

  if (
    !headquarter?.ubigeoCode ||
    !destinationUbigeo ||
    !size ||
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    return null;
  }

  const base = {
    originUbigeo: headquarter.ubigeoCode,
    destinationUbigeo,
    deliveryType: deliveryType ?? OLVA_DELIVERY_TYPES.STORE_PICKUP,
    weightKg: weight,
  };
  const { lengthCm, widthCm, heightCm } = size;

  if (lengthCm === null && widthCm === null && heightCm === null) {
    return { ...base, shipmentType: OLVA_QUOTE_SHIPMENT_TYPES.DOCUMENT };
  }

  // A size with only some of its measures cannot be quoted
  if (lengthCm === null || widthCm === null || heightCm === null) return null;

  return { ...base, shipmentType: OLVA_QUOTE_SHIPMENT_TYPES.PACKAGE, lengthCm, widthCm, heightCm };
}
