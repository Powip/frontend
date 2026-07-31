"use client";

import { useCallback, useMemo, useState } from "react";
import { EstadoComprobante } from "@/types/facturacion";
import { useAuth } from "@/contexts/AuthContext";
import { useSalesByStore } from "./sales/use-stales-by-store";
import { useSunatDocuments } from "./sunat/sunat-document/use-sunat-documents";
import { Order } from "@/models/sales/order";
import { SunatDocument } from "@/models/sunat/sunat-document";
import { CdrStatus } from "@/api/sunat/types/sunat-document.types";

export interface ComprobanteRow {
  sale: Order;
  /** Último documento SUNAT emitido para esta venta, si existe. */
  document?: SunatDocument;
  estado: EstadoComprobante;
  tipo: "01" | "03" | null;
  fullNumber: string | null;
}

function mapCdrStatusToEstado(status: CdrStatus): EstadoComprobante {
  switch (status) {
    case "ACCEPTED":
      return "ACEPTADO";
    case "OBSERVED":
      return "ACEPTADO_CON_OBS";
    case "PENDING":
      return "ENVIADO_OSE";
    case "REJECTED":
    case "RETRY_EXCEEDED":
      return "RECHAZADO";
    default:
      return "SIN_EMITIR";
  }
}

// Stable references so an undefined react-query `data` never forces
// downstream useMemo/useEffect dependents to re-run every render.
const EMPTY_SALES: Order[] = [];
const EMPTY_DOCUMENTS: SunatDocument[] = [];

export function useComprobantesSunat() {
  const { selectedStoreId } = useAuth();

  const {
    data: sales = EMPTY_SALES,
    isLoading: loadingSales,
    refetch: refreshSales,
  } = useSalesByStore(selectedStoreId ?? "");

  const {
    data: documents = EMPTY_DOCUMENTS,
    isLoading: loadingDocuments,
    refetch: refreshDocuments,
  } = useSunatDocuments();

  // Documents come back ordered desc by created_at from the backend
  // (see SunatPersistenceService.getDocumentsByCompany), so the first
  // one seen per external_id (sale id) is the latest for that sale.
  const documentBySaleId = useMemo(() => {
    const map = new Map<string, SunatDocument>();
    for (const doc of documents) {
      if (!map.has(doc.externalId)) {
        map.set(doc.externalId, doc);
      }
    }
    return map;
  }, [documents]);

  function getInvoiceTotal(row: ComprobanteRow): number {
    return (
      row.document?.invoicePayload?.totals?.totalPrice ??
      Number(row.sale.grandTotal)
    );
  }

  // Derived, not stored in state — no useEffect/setState loop possible
  // here since rows is just a projection of sales + documents.
  const rows: ComprobanteRow[] = useMemo(() => {
    return sales
      .filter((sale) => sale.status === "ENTREGADO")
      .map((sale): ComprobanteRow => {
        const document = documentBySaleId.get(sale.id);
        return {
          sale,
          document,
          estado: document ? mapCdrStatusToEstado(document.cdrStatus) : "SIN_EMITIR",
          tipo: document ? document.documentType : null,
          fullNumber: document ? `${document.series}-${document.correlative}` : null,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.sale.createdAt).getTime() -
          new Date(a.sale.createdAt).getTime()
      );
  }, [sales, documentBySaleId]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const kpis = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const emitidosHoy = rows.filter(
      (r) =>
        (r.estado === "ACEPTADO" || r.estado === "ACEPTADO_CON_OBS") &&
        r.document &&
        r.document.createdAt.toDateString() === today
    ).length;
    const pendientes = rows.filter((r) => r.estado === "SIN_EMITIR").length;
    const rechazados = rows.filter((r) => r.estado === "RECHAZADO").length;
    const facturadoMes = rows
      .filter(
        (r) =>
          (r.estado === "ACEPTADO" || r.estado === "ACEPTADO_CON_OBS") &&
          r.document &&
          r.document.createdAt.getMonth() === now.getMonth() &&
          r.document.createdAt.getFullYear() === now.getFullYear()
      )
      .reduce((sum, row) => sum + getInvoiceTotal(row), 0);
    return { emitidosHoy, pendientes, rechazados, facturadoMes };
  }, [rows]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAllPendientes = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(
        new Set(rows.filter((r) => r.estado === "SIN_EMITIR").map((r) => r.sale.id))
      );
    },
    [rows]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    rows,
    loading: loadingSales || loadingDocuments,
    kpis,
    selectedIds,
    refreshSales,
    refreshDocuments,
    toggleSelected,
    selectAllPendientes,
    clearSelection,
  };
}
