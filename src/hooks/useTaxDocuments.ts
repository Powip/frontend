"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessSales } from "@/features/sales/hooks/use-business-sales";
import {
  EMPTY_DOCUMENTS,
  EMPTY_SALES,
  isTaxDocumentEligibleStatus,
} from "@/features/sunat/shared/constants/sunat.constants";
import { SUNAT_DOCUMENT_TYPES } from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { fetchAllSunatDocuments } from "@/features/sunat/sunat-document/utils/fetch-all-sunat-documents";
import { isPrepaymentDocument } from "@/features/sunat/sunat-document/utils/prepayments";
import { computeTaxDocumentKpis } from "@/features/sunat/sunat-document/utils/tax-document-kpis";

const isNoteDocument = (document: SunatDocument) =>
  document.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE ||
  document.taxDocumentType === SUNAT_DOCUMENT_TYPES.DEBIT_NOTE;

export function useTaxDocuments() {
  const { auth } = useAuth();
  const { scopeKey, canFetch } = useBusinessScope();

  const {
    data: sales = EMPTY_SALES,
    isLoading: loadingSales,
    refetch: refreshSales,
    isError: salesError,
  } = useBusinessSales();

  const documentsQuery = useQuery({
    queryKey: ["business-tax-documents", auth?.company?.id, auth?.user?.id],
    enabled: canFetch,
    queryFn: ({ signal }) => fetchAllSunatDocuments(signal),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some((document) => document.cdrStatus === "PENDING") ? 4000 : false,
  });
  const loadingListDocuments = documentsQuery.isPending;
  const refreshListDocuments = documentsQuery.refetch;
  const error = salesError || documentsQuery.isError;
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;

  /**
   * The backend returns SUNAT documents ordered from newest to oldest.
   *
   * We keep only the first factura/boleta belonging to each sale/order.
   * Credit/debit notes share the sale's `orderId` but never replace its
   * comprobante in the row: they are listed apart (`creditNotes`). A sale
   * whose only documents are notes still shows the newest one.
   *
   * `orderId` is the relation between the SUNAT document and the sale.
   *
   * Anticipos never take the row either: the sale still waits for its final
   * comprobante. They are listed apart (`prepaymentsByOrderId`).
   */
  const documentByOrderId = useMemo(() => {
    const map = new Map<string, SunatDocument>();

    for (const document of documents) {
      if (isPrepaymentDocument(document)) continue;

      const current = map.get(document.orderId);
      if (!current || (isNoteDocument(current) && !isNoteDocument(document))) {
        map.set(document.orderId, document);
      }
    }

    return map;
  }, [documents]);

  /** Anticipos of each sale, newest first. */
  const prepaymentsByOrderId = useMemo(() => {
    const map = new Map<string, SunatDocument[]>();

    for (const document of documents) {
      if (!isPrepaymentDocument(document)) continue;
      map.set(document.orderId, [...(map.get(document.orderId) ?? []), document]);
    }

    return map;
  }, [documents]);

  /** Credit notes (07) of the company, newest first. */
  const creditNotes = useMemo(
    () =>
      documents.filter((document) => document.taxDocumentType === SUNAT_DOCUMENT_TYPES.CREDIT_NOTE),
    [documents],
  );

  /**
   * Build the rows consumed by the tax-document UI.
   *
   * Only sales in an eligible status (from `PREPARADO` onwards, see
   * `TAX_DOCUMENT_ELIGIBLE_ORDER_STATUSES`) participate in the SUNAT
   * document workflow.
   */
  const rows = useMemo<TaxDocumentRow[]>(() => {
    if (error) return [];
    return sales
      .filter((sale) => isTaxDocumentEligibleStatus(sale.status))
      .map((sale) => ({
        sale,
        taxDocument: documentByOrderId.get(sale.id),
        prepayments: prepaymentsByOrderId.get(sale.id),
      }))
      .sort((a, b) => new Date(b.sale.createdAt).getTime() - new Date(a.sale.createdAt).getTime());
  }, [sales, documentByOrderId, prepaymentsByOrderId, error]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // The selection belongs to one business scope: clear it whenever the scope changes. `scopeKey`
  // is not read inside the effect, it is only the trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scopeKey is the reset trigger
  useEffect(() => {
    setSelectedIds(new Set());
  }, [scopeKey]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }, []);

  const selectAllPending = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }

      // A sale with anticipos is billed from "Emitir": its final must deduct them.
      setSelectedIds(
        new Set(
          rows
            .filter((row) => !row.taxDocument && !row.prepayments?.length)
            .map((row) => row.sale.id),
        ),
      );
    },
    [rows],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.sale.id)),
    [rows, selectedIds],
  );

  const kpis = useMemo(() => computeTaxDocumentKpis(rows), [rows]);

  return {
    rows,
    /** Every SUNAT document of the company (comprobantes and notes). */
    documents,
    creditNotes,
    loading: loadingSales || loadingListDocuments,
    error,

    kpis,

    selectedIds,
    selectedRows,

    refreshSales,
    refreshListDocuments,

    toggleSelected,
    selectAllPending,
    clearSelection,
  };
}
