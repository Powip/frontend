import { useQueries } from "@tanstack/react-query";
import { olvaAgencyQueries } from "@/features/olva/olva-agency/queries/olva-agency.queries";
import { useOlvaStandardSizes } from "@/features/olva/olva-catalog/hooks/use-olva-standard-sizes";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { resolveOlvaSize } from "@/features/olva/olva-catalog/utils/resolve-olva-size";
import { olvaQuoteQueries } from "@/features/olva/olva-quote/queries/olva-quote.queries";
import { buildOlvaQuoteInput, getOlvaDestinationUbigeo } from "../utils/build-olva-quote-input";
import { isOlvaHomeRow } from "../utils/derive-olva-lot-payer";
import type { SendToOlvaFormItem } from "../utils/order-to-olva-form-item";

/**
 * The estimated cost of the whole lot. It reads the same queries the order cards use (same keys),
 * so it adds no requests. Orders that share an agency or a quote share one query here too: the
 * same key twice in one `useQueries` is a (warned) duplicate.
 */
export function useOlvaQuoteTotal(
  items: readonly SendToOlvaFormItem[],
  headquarter: OlvaHeadquarter | undefined,
) {
  const sizes = useOlvaStandardSizes().data ?? [];
  const agencyCodes = [
    ...new Set(
      // A home delivery is priced from its district, so it has no agency to look up
      items.flatMap((item) =>
        !isOlvaHomeRow(item) && item.destination?.agencyCode ? [item.destination.agencyCode] : [],
      ),
    ),
  ];
  const agencyResults = useQueries({
    queries: agencyCodes.map((code) => olvaAgencyQueries.detail(code)),
  });
  const agencyByCode = new Map(
    agencyCodes.map((code, index) => [code, agencyResults[index]?.data]),
  );

  const inputs = items.map((item) =>
    buildOlvaQuoteInput({
      headquarter,
      destinationUbigeo: getOlvaDestinationUbigeo({
        deliveryType: item.deliveryType,
        ubigeoCode: item.destination?.ubigeoCode,
        agency: agencyByCode.get(item.destination?.agencyCode ?? ""),
      }),
      deliveryType: item.deliveryType,
      weightKg: item.package?.weightKg,
      size: resolveOlvaSize(sizes, {
        sizeId: item.package?.sizeId,
        weightKg: item.package?.weightKg,
      }),
    }),
  );
  const uniqueInputs = new Map(
    inputs.flatMap((input) => (input ? [[JSON.stringify(input), input] as const] : [])),
  );
  const keys = [...uniqueInputs.keys()];
  const quoteResults = useQueries({
    queries: keys.map((key) => olvaQuoteQueries.calculation(uniqueInputs.get(key) ?? null)),
  });
  const amountByKey = new Map(keys.map((key, index) => [key, quoteResults[index]?.data?.amount]));

  // Each order adds its own quote, even when it is the same price as another
  const amounts = inputs.map((input) =>
    input ? amountByKey.get(JSON.stringify(input)) : undefined,
  );

  return {
    total: amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0),
    quoted: amounts.filter((amount) => amount !== undefined).length,
    isLoading: quoteResults.some((result) => result.isFetching),
  };
}
