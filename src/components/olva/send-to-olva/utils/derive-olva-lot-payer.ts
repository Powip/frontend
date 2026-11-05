import {
  OLVA_DELIVERY_TYPES,
  type OlvaPaymentMethod,
  type OlvaWhoPays,
} from "@/features/olva/shared/constants/olva-enums.constants";

interface PayerRow {
  deliveryType?: string;
  whoPays?: OlvaWhoPays;
  paymentMethod?: OlvaPaymentMethod;
}

export interface OlvaLotPayer {
  /** Index of the row the lot-level selects are bound to. */
  index: number;
  whoPays: OlvaWhoPays | undefined;
  paymentMethod: OlvaPaymentMethod | undefined;
}

export const isOlvaHomeRow = (row: Pick<PayerRow, "deliveryType"> | undefined): boolean =>
  row?.deliveryType === OLVA_DELIVERY_TYPES.HOME_DELIVERY;

/**
 * The lot-level payer (who pays, and how when it is online) only concerns store pickups: a home
 * delivery is always paid online with its own method. It is read from the first pickup row, and
 * is `undefined` when the lot has no pickup at all (then there is no lot payer to ask for).
 */
export function deriveOlvaLotPayer(rows: readonly PayerRow[]): OlvaLotPayer | undefined {
  const index = rows.findIndex((row) => !isOlvaHomeRow(row));
  const row = rows[index];

  if (index === -1 || !row) return undefined;

  return { index, whoPays: row.whoPays, paymentMethod: row.paymentMethod };
}

/** Every row can be sent: each pickup has a payer (home rows bring their own, already ONLINE). */
export function hasOlvaPayerForEveryRow(rows: readonly PayerRow[]): boolean {
  return rows.every((row) => isOlvaHomeRow(row) || Boolean(row.whoPays));
}
