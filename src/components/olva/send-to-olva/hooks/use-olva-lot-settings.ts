import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { OLVA_WHO_PAYS_OPTIONS } from "@/features/olva/shared/constants/olva-enums.constants";
import type { SendToOlvaFormValues } from "../components/fields/olva-form-types";
import { isOlvaHomeRow } from "../utils/derive-olva-lot-payer";

/**
 * Origin and payment are chosen once for the whole lot and written into every order row, so the
 * rows stay the single source of truth the schema validates (no second copy to keep in sync).
 *
 * The payer is the exception for home deliveries: they are always paid online with a method of
 * their own (picked in the row), so the lot-level payer never touches them.
 */
export function useOlvaLotSettings() {
  const { getValues, setValue } = useFormContext<SendToOlvaFormValues>();

  const applyOrigin = useCallback(
    (headquarterId: string) => {
      getValues("items").forEach((item, index) => {
        setValue(`items.${index}.origin.headquarterId`, headquarterId, { shouldValidate: false });
        // What the old headquarter accepted may not be accepted by the new one
        setValue(
          `items.${index}.whoPays`,
          isOlvaHomeRow(item) ? OLVA_WHO_PAYS_OPTIONS.ONLINE : undefined,
        );
        setValue(`items.${index}.paymentMethod`, undefined);
      });
    },
    [getValues, setValue],
  );

  const applyWhoPays = useCallback(
    (whoPays: SendToOlvaFormValues["items"][number]["whoPays"]) => {
      getValues("items").forEach((item, index) => {
        if (isOlvaHomeRow(item)) return;

        setValue(`items.${index}.whoPays`, whoPays, { shouldValidate: true });
        setValue(`items.${index}.paymentMethod`, undefined);
      });
    },
    [getValues, setValue],
  );

  const applyPaymentMethod = useCallback(
    (paymentMethod: SendToOlvaFormValues["items"][number]["paymentMethod"]) => {
      getValues("items").forEach((item, index) => {
        if (isOlvaHomeRow(item)) return;

        setValue(`items.${index}.paymentMethod`, paymentMethod, { shouldValidate: true });
      });
    },
    [getValues, setValue],
  );

  return { applyOrigin, applyWhoPays, applyPaymentMethod };
}
