import { useFormContext, useWatch } from "react-hook-form";
import { useOlvaHeadquarters } from "@/features/olva/olva-catalog/hooks/use-olva-headquarters";
import type { SendToOlvaFormValues } from "../components/fields/olva-form-types";

/** The origin headquarter of the lot: every order leaves from the one picked in the sender section. */
export function useSelectedOlvaHeadquarter() {
  const { control } = useFormContext<SendToOlvaFormValues>();
  const headquarters = useOlvaHeadquarters();
  const headquarterId = useWatch({ control, name: "items.0.origin.headquarterId" });
  const headquarter = headquarters.data?.find((item) => item.id === headquarterId);

  return { headquarters, headquarterId: headquarterId ?? "", headquarter };
}
