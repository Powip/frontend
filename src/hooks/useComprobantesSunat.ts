"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  generateManualInvoice,
  getInvoiceLogByExternalId,
  IManualInvoicePayload,
} from "@/api/Facturacion";
import { EstadoComprobante } from "@/types/facturacion";
import { useAuth } from "@/contexts/AuthContext";

export interface SaleCustomer {
  fullName: string;
  documentNumber?: string | null;
  documentType?: string | null;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

export interface SaleItem {
  productName: string;
  quantity: number;
  price: number;
  sku?: string;
}

export interface Sale {
  id: string;
  orderNumber: string;
  grandTotal: number;
  status: string;
  created_at: string;
  externalData?: any;
  customer: SaleCustomer;
  items: SaleItem[];
}

export interface SunatLog {
  status: "PENDING" | "ACCEPTED" | "OBSERVED" | "REJECTED" | "NOT_ISSUED";
  document_type?: string;
  series?: string;
  correlative?: number;
  xml_url?: string;
  cdr_url?: string;
  sunat_description?: string;
  observations?: string;
  response_description?: string;
}

export interface ComprobanteRow {
  sale: Sale;
  log?: SunatLog;
  estado: EstadoComprobante;
  tipo: "01" | "03" | null;
  fullNumber: string | null;
}

function mapEstado(log: SunatLog | undefined): EstadoComprobante {
  if (!log || log.status === "NOT_ISSUED") return "SIN_EMITIR";
  switch (log.status) {
    case "PENDING":
      return "ENVIADO_OSE";
    case "ACCEPTED":
      return "ACEPTADO";
    case "OBSERVED":
      return "ACEPTADO_CON_OBS";
    case "REJECTED":
      return "RECHAZADO";
    default:
      return "SIN_EMITIR";
  }
}

export interface BulkEmitResult {
  saleId: string;
  orderNumber: string;
  ok: boolean;
  message: string;
}

export function useComprobantesSunat() {
  const { selectedStoreId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [sunatLogs, setSunatLogs] = useState<Record<string, SunatLog>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchSales = useCallback(async () => {
    if (!selectedStoreId) return;
    try {
      setLoading(true);
      const { data } = await axiosAuth.get(
        `${GATEWAY.ventas}/order-header/store/${selectedStoreId}`
      );
      const deliveredSales: Sale[] = data.filter((s: any) => s.status === "ENTREGADO");
      setSales(deliveredSales);

      deliveredSales.forEach(async (sale) => {
        const log = await getInvoiceLogByExternalId(sale.id);
        setSunatLogs((prev) => ({
          ...prev,
          [sale.id]: log.success && log.data ? log.data : { status: "NOT_ISSUED" },
        }));
      });
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Error al cargar las ventas");
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) fetchSales();
  }, [selectedStoreId, fetchSales]);

  const rows: ComprobanteRow[] = useMemo(
    () =>
      sales
        .map((sale) => {
          const log = sunatLogs[sale.id];
          return {
            sale,
            log,
            estado: mapEstado(log),
            tipo: (log?.document_type as "01" | "03" | undefined) ?? null,
            fullNumber:
              log?.series && log?.correlative != null
                ? `${log.series}-${String(log.correlative).padStart(8, "0")}`
                : null,
          };
        })
        .sort((a, b) => new Date(b.sale.created_at).getTime() - new Date(a.sale.created_at).getTime()),
    [sales, sunatLogs]
  );

  const kpis = useMemo(() => {
    const today = new Date().toDateString();
    const emitidosHoy = rows.filter(
      (r) =>
        (r.estado === "ACEPTADO" || r.estado === "ACEPTADO_CON_OBS") &&
        new Date(r.sale.created_at).toDateString() === today
    ).length;
    const pendientes = rows.filter((r) => r.estado === "SIN_EMITIR").length;
    const rechazados = rows.filter((r) => r.estado === "RECHAZADO").length;
    const facturadoMes = rows
      .filter((r) => r.estado === "ACEPTADO" || r.estado === "ACEPTADO_CON_OBS")
      .reduce((s, r) => s + Number(r.sale.grandTotal || 0), 0);
    return { emitidosHoy, pendientes, rechazados, facturadoMes };
  }, [rows]);

  const refreshLog = useCallback(async (saleId: string) => {
    const log = await getInvoiceLogByExternalId(saleId);
    if (log.success && log.data) {
      setSunatLogs((prev) => ({ ...prev, [saleId]: log.data }));
    }
    return log;
  }, []);

  const emitInvoice = useCallback(
    async (payload: IManualInvoicePayload) => {
      const res = await generateManualInvoice(payload);
      if (res.success) {
        await refreshLog(payload.externalId);
      }
      return res;
    },
    [refreshLog]
  );

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
      setSelectedIds(new Set(rows.filter((r) => r.estado === "SIN_EMITIR").map((r) => r.sale.id)));
    },
    [rows]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    rows,
    loading,
    kpis,
    selectedIds,
    fetchSales,
    emitInvoice,
    refreshLog,
    toggleSelected,
    selectAllPendientes,
    clearSelection,
  };
}
