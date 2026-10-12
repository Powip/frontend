"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import type { ListSunatDocumentsResponseDto } from "@/features/sunat/sunat-document/dto/list-sunat-documents-response.dto";
import { toListSunatDocumentsResult } from "@/features/sunat/sunat-document/mappers/to-list-sunat-documents.mapper";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import { useBusinessSales } from "@/features/sales/hooks/use-business-sales";
import { EMPTY_DOCUMENTS, EMPTY_SALES } from "@/features/sunat/shared/constants/sunat.constants";
import { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

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
    queryFn: async ({ signal }) => {
      const byId = new Map<string, SunatDocument>();
      let offset = 0;
      while (true) {
        const response = await axiosAuth.get<ListSunatDocumentsResponseDto>(`${API.sunat}/api/v1/sunat-documents`, { params: { limit: 100, offset }, signal });
        const page = toListSunatDocumentsResult(response.data);
        page.documents.forEach((document) => byId.set(document.id, document));
        offset += page.documents.length;
        if (offset >= page.total) break;
        if (page.documents.length === 0) throw new Error("Respuesta incompleta de comprobantes");
      }
      return [...byId.values()];
    },
    retry: false,
    refetchInterval: (query) => query.state.data?.some((document) => document.cdrStatus === "PENDING") ? 4000 : false,
  });
  const loadingListDocuments = documentsQuery.isPending;
  const refreshListDocuments = documentsQuery.refetch;
  const error = salesError || documentsQuery.isError;
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;

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
    if (error) return [];
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
  }, [sales, documentByOrderId, error]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => { setSelectedIds(new Set()); }, [scopeKey]);

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
