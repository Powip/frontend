"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import type { SunatDocument } from "../models/sunat-document.model";
import { fetchAllSunatDocuments } from "../utils/fetch-all-sunat-documents";
import { findOpenPrepayments, isPrepaymentReady } from "../utils/prepayments";

export interface OrderPrepayments {
  /** Anticipos SUNAT accepted: the final comprobante deducts them. */
  ready: SunatDocument[];
  /** Anticipos still on their way to SUNAT: the final must wait for them. */
  waiting: SunatDocument[];
  isLoading: boolean;
}

/**
 * Anticipos of the order still to deduct. Uses the same query (same cache
 * key) as the Facturación screen.
 */
export function useOrderPrepayments(
  orderId: string | null | undefined,
  enabled = true,
): OrderPrepayments {
  const { auth } = useAuth();
  const { canFetch } = useBusinessScope();

  const query = useQuery({
    queryKey: ["business-tax-documents", auth?.company?.id, auth?.user?.id],
    enabled: enabled && canFetch && Boolean(orderId),
    queryFn: ({ signal }) => fetchAllSunatDocuments(signal),
    retry: false,
  });

  return useMemo(() => {
    const open = findOpenPrepayments(
      (query.data ?? []).filter((document) => document.orderId === orderId),
    );

    return {
      ready: open.filter(isPrepaymentReady),
      waiting: open.filter((document) => !isPrepaymentReady(document)),
      isLoading: query.isPending && Boolean(orderId) && enabled,
    };
  }, [orderId, query.data, query.isPending, enabled]);
}
