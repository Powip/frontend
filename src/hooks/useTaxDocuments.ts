"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-list-sunat-documents";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import { useSalesByStore } from "./sales/use-stales-by-store";
import { EMPTY_DOCUMENTS, EMPTY_SALES } from "@/features/sunat/shared/constants/sunat.constants";
import { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

export function useTaxDocuments() {
  const { selectedStoreId } = useAuth();

  const {
    data: sales = EMPTY_SALES,
    isLoading: loadingSales,
    refetch: refreshSales,
  } = useSalesByStore(selectedStoreId ?? "");

  const {
    data: documentResponse,
    isLoading: loadingListDocuments,
    refetch: refreshListDocuments,
  } = useListSunatDocuments({
    limit: 100,
    offset: 0,
  });

  const documents = documentResponse?.documents ?? EMPTY_DOCUMENTS;

  /**
   * The backend returns SUNAT documents ordered from newest to oldest.
   *
   * We keep only the first document belonging to each sale/order.
   *
   * `orderId` is the relation between the SUNAT document and the sale.
   */
  const documentByOrderId = useMemo(() => {
    const map = new Map<string, SunatDocument>();

    for (const document of documents) {
      if (!map.has(document.orderId)) {
        map.set(document.orderId, document);
      }
    }

    return map;
  }, [documents]);

  /**
   * Build the rows consumed by the tax-document UI.
   *
   * Only delivered sales participate in the SUNAT document workflow.
   */
  const rows = useMemo<TaxDocumentRow[]>(() => {
    return sales
      .filter((sale) => sale.status === "ENTREGADO")
      .map((sale) => ({
        sale,
        taxDocument: documentByOrderId.get(sale.id),
      }))
      .sort(
        (a, b) =>
          new Date(b.sale.createdAt).getTime() -
          new Date(a.sale.createdAt).getTime(),
      );
  }, [sales, documentByOrderId]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

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

      setSelectedIds(
        new Set(
          rows
            .filter((row) => !row.taxDocument)
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

  /**
   * KPI calculations intentionally use the SUNAT document itself as the
   * source of truth.
   */
  const kpis = useMemo(() => {
    const now = new Date();

    const emitidosHoy = rows.filter((row) => {
      const status = row.taxDocument?.cdrStatus;

      if (
        status !== "ACCEPTED" &&
        status !== "ACCEPTED_WITH_OBSERVATION"
      ) {
        return false;
      }

      if (!row.taxDocument) {
        return false;
      }

      const createdAt = new Date(row.taxDocument.createdAt);

      return (
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getDate() === now.getDate()
      );
    }).length;

    const pendientes = rows.filter(
      (row) => !row.taxDocument,
    ).length;

    const rechazados = rows.filter((row) => {
      const status = row.taxDocument?.cdrStatus;

      return (
        status === "REJECTED" ||
        status === "RETRY_EXCEEDED"
      );
    }).length;

    const facturadoMes = rows
      .filter((row) => {
        const status = row.taxDocument?.cdrStatus;

        if (
          status !== "ACCEPTED" &&
          status !== "ACCEPTED_WITH_OBSERVATION"
        ) {
          return false;
        }

        if (!row.taxDocument) {
          return false;
        }

        const createdAt = new Date(row.taxDocument.createdAt);

        return (
          createdAt.getFullYear() === now.getFullYear() &&
          createdAt.getMonth() === now.getMonth()
        );
      })
      .reduce((total, row) => {
        const documentTotal =
          row.taxDocument?.taxDocumentPayload.totals.grandTotal;

        return total + Number(documentTotal ?? row.sale.grandTotal);
      }, 0);

    return {
      emitidosHoy,
      pendientes,
      rechazados,
      facturadoMes,
    };
  }, [rows]);

  return {
    rows,
    loading: loadingSales || loadingListDocuments,

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
