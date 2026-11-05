import { useOlvaAgency } from "@/features/olva/olva-agency/hooks/use-olva-agency";
import { useOlvaStandardSizes } from "@/features/olva/olva-catalog/hooks/use-olva-standard-sizes";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { getOlvaSizeWeightError } from "@/features/olva/olva-catalog/utils/get-olva-size-weight-error";
import { resolveOlvaSize } from "@/features/olva/olva-catalog/utils/resolve-olva-size";
import { useOlvaQuote } from "@/features/olva/olva-quote/hooks/use-olva-quote";
import {
  OLVA_DELIVERY_TYPES,
  type OlvaDeliveryType,
} from "@/features/olva/shared/constants/olva-enums.constants";
import { buildOlvaQuoteInput, getOlvaDestinationUbigeo } from "../utils/build-olva-quote-input";

interface UseOlvaItemQuoteParams {
  headquarter: OlvaHeadquarter | undefined;
  /** Store pickup: the agency the destination is priced from. */
  agencyCode: string | undefined;
  /** Home delivery: the district's ubigeo the destination is priced from. */
  ubigeoCode: string | undefined;
  deliveryType: OlvaDeliveryType | undefined;
  weightKg: unknown;
  /** The size picked in the card; blank means Olva chooses by weight. */
  sizeId: string | undefined;
}

/**
 * The live price of one order: idle until origin, destination (agency or district), weight and
 * size are all known. `weightError` says when the weight does not fit the size (Olva would
 * answer 422). A home delivery has no agency, so none is fetched for it.
 */
export function useOlvaItemQuote({
  headquarter,
  agencyCode,
  ubigeoCode,
  deliveryType,
  weightKg,
  sizeId,
}: UseOlvaItemQuoteParams) {
  const isHome = deliveryType === OLVA_DELIVERY_TYPES.HOME_DELIVERY;
  const agency = useOlvaAgency(isHome ? null : agencyCode || null);
  const sizes = useOlvaStandardSizes();
  const catalog = sizes.data ?? [];
  const size = resolveOlvaSize(catalog, { sizeId, weightKg });
  const weightError = getOlvaSizeWeightError(catalog, { sizeId, weightKg });
  const destinationUbigeo = getOlvaDestinationUbigeo({
    deliveryType,
    ubigeoCode,
    agency: agency.data,
  });
  const quote = useOlvaQuote(
    buildOlvaQuoteInput({ headquarter, destinationUbigeo, deliveryType, weightKg, size }),
  );

  return { agency, quote, sizes, weightError };
}
