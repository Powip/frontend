"use client";
import { getNumbersV23 } from "@/services/advertisingV23Service";
import { useAdsQuery } from "./context";

/** Store and account filters are applied after loading the complete residual pool. */
export function useRawNumbersV23(from: string, to: string, enabled = true) {
  return useAdsQuery(
    ["numbers-v23", from, to],
    (identity, signal) => getNumbersV23(identity, from, to, signal),
    enabled && from <= to,
  );
}
