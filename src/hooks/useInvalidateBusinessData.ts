"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const BUSINESS_DATA_KEYS = [
  "business-orders",
  "business-guides",
  "business-sales",
  "business-finance-cod-leads",
  "cc-pedidos",
  "cc-pedidos-all",
  "cc-kpis",
  "cc-agentes-kpis",
];

export function useInvalidateBusinessData() {
  const queryClient = useQueryClient();
  return useCallback(() => Promise.all(
    BUSINESS_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  ), [queryClient]);
}
