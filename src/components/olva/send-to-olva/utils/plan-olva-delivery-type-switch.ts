import {
  OLVA_DELIVERY_TYPES,
  OLVA_WHO_PAYS_OPTIONS,
  type OlvaPaymentMethod,
  type OlvaWhoPays,
} from "@/features/olva/shared/constants/olva-enums.constants";

/** A field of the row (relative to `items.N.`) and the value it takes. */
export interface OlvaFieldReset {
  field:
    | "pin"
    | "whoPays"
    | "paymentMethod"
    | "destination.agencyCode"
    | "destination.ubigeoCode"
    | "destination.address";
  value: string | undefined;
}

interface PlanParams {
  next: string;
  /** What the lot-level payer currently holds (from the other pickup rows), restored on the way back to pickup. */
  lotPayer: { whoPays: OlvaWhoPays | undefined; paymentMethod: OlvaPaymentMethod | undefined };
  /** The method a home delivery starts with (see `getDefaultOlvaHomePaymentMethod`). */
  homePaymentMethod: OlvaPaymentMethod | undefined;
  /** Address the row holds now and the customer's own one. */
  currentAddress: string | undefined;
  customerAddress: string | undefined;
}

export interface OlvaDeliveryTypeSwitchPlan {
  resets: OlvaFieldReset[];
  /** Fields (relative to `items.N.`) whose old error no longer applies. */
  clearErrors: string[];
}

/**
 * What changes in a row when its delivery type changes, so a field of the other type can never
 * stay hidden and block or pollute the submit.
 *
 * - To home: the agency and PIN are dropped; it is always paid online (`whoPays` ONLINE) with its
 *   own method; the customer's address comes back if the row has none.
 * - To pickup: the ubigeo is dropped and the row takes the lot payer again. Address and reference
 *   are kept: pickup ignores them, and the user may come back.
 */
export function planOlvaDeliveryTypeSwitch({
  next,
  lotPayer,
  homePaymentMethod,
  currentAddress,
  customerAddress,
}: PlanParams): OlvaDeliveryTypeSwitchPlan {
  if (next === OLVA_DELIVERY_TYPES.HOME_DELIVERY) {
    const resets: OlvaFieldReset[] = [
      { field: "pin", value: "" },
      { field: "destination.agencyCode", value: "" },
      { field: "whoPays", value: OLVA_WHO_PAYS_OPTIONS.ONLINE },
      { field: "paymentMethod", value: homePaymentMethod },
    ];

    if (!currentAddress) {
      resets.push({ field: "destination.address", value: customerAddress ?? "" });
    }

    return { resets, clearErrors: ["pin", "destination.agencyCode", "whoPays", "paymentMethod"] };
  }

  return {
    resets: [
      { field: "destination.ubigeoCode", value: "" },
      { field: "whoPays", value: lotPayer.whoPays },
      { field: "paymentMethod", value: lotPayer.paymentMethod },
    ],
    clearErrors: [
      "destination.ubigeoCode",
      "destination.address",
      "destination.reference",
      "whoPays",
      "paymentMethod",
    ],
  };
}
