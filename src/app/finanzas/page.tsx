"use client";
import { saleSourceKey } from "@/utils/saleLabels";
import { commercialLeadHref } from "@/utils/commercialOrders";
import { toWhatsAppDigits } from "@/lib/phone";
import { formatSalesMoney } from "@/utils/salesMoney";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil,
  ArrowLeft,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Label } from "@/components/ui/label";

import { OrderHeader, OrderStatus, SubEstadoCc } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { useQuery } from "@tanstack/react-query";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useInvalidateBusinessData } from "@/hooks/useInvalidateBusinessData";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessGuides } from "@/hooks/useBusinessGuides";
import {
  OrderDetailButton,
  OrderDetailModalProvider,
} from "@/components/orders/OrderDetailModal";
import { formatGoogleMapsClipboardLine } from "@/components/shared/MapsLink";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
} from "@/components/ventas/SalesTableFilters";
import { LiquidacionesCourierTab } from "@/components/finanzas/LiquidacionesCourierTab";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { Copy, Printer, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CancellationModal, {
  CancellationReason,
} from "@/components/modals/CancellationModal";
import { getAvailableStatuses } from "@/utils/domain/orders-status-flow";
import { openPrintWindow, printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";
import CommentsTimelineModal from "@/components/modals/CommentsTimelineModal";
import { ReviewDialog } from "@/features/live/LiveYapeReviews";
import { canReviewLivePayments, getLiveYapeReviews } from "@/features/live/liveService";
import type { LiveYapeReview } from "@/features/live/types";
import LeadPaymentsTab from "@/components/finanzas/LeadPaymentsTab";
import { CrmPauActions, CrmPauDetail, useCrmPauReceipts } from "@/components/finanzas/CrmPauReceipts";
import type { PaymentReceipt } from "@/types/crmOrderPanel";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import { exportSalesToExcel, SaleExportData } from "@/utils/exportSalesExcel";
import { saleReceiptUrl, type UnitAssignmentState } from "@/services/saleTrackingService";

/* -----------------------------------------
   Types
----------------------------------------- */

const ORDER_STATUS = {
  PENDIENTE: "PENDIENTE",
  PREPARADO: "PREPARADO",
  LLAMADO: "LLAMADO",
  EN_ENVIO: "EN_ENVIO",
  DESPACHADO: "DESPACHADO",
  ENTREGADO: "ENTREGADO",
  ANULADO: "ANULADO",
};

const ALL_STATUSES: OrderStatus[] = [
  "PENDIENTE",
  "PREPARADO",
  "LLAMADO",
  "EN_ENVIO",
  "DESPACHADO",
  "ENTREGADO",
  "ANULADO",
];

// Denylist: cualquier orden viva con pago por aprobar aparece en "Pagos Pendientes".
// Solo se excluyen borradores (INCOMPLETE/PREVENTA) y anuladas.
const PAGOS_PENDIENTES_EXCLUDED_STATUSES: OrderStatus[] = [
  "INCOMPLETE",
  "PREVENTA",
  "ANULADO",
];

const CC_CONFIRMED_SUBESTADOS: SubEstadoCc[] = ["confirmado", "reprogramado"];

export interface Sale extends UnitAssignmentState {
  currency?: string | null;
  commercialStage?: "LEAD" | "SALE" | null;
  commercialLeadId?: string | null;
  commercialStockState?: "DEFERRED" | "QUEUED" | "PRESERVED" | "NOT_REQUIRED" | null;

  items?: OrderHeader["items"];
  id: string;
  storeId: string;
  inventoryId?: string | null;
  stockStoreId?: string | null;
  orderNumber: string;
  clientName: string;
  phoneNumber: string;
  documentType?: string | null;
  documentNumber?: string | null;
  date: string;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  deliveryType: string;
  salesRegion: "LIMA" | "PROVINCIA";
  district: string;
  address: string;
  googleMapsUrl?: string | null;
  advancePayment: number;
  pendingPayment: number;
  courier: string | null;
  // Nuevos campos para pagos
  hasPendingPayments: boolean;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  // Campos de guía de envío (ms-courier)
  shippingDeliveryType?: string;
  shippingCourierName?: string;
  // Nuevos campos para la tabla de pagos
  city: string;
  province?: string;
  zone?: string;
  paymentCreatedAt: string | null;
  sellerName: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  subEstadoCc?: SubEstadoCc | null;
  /** FEAT-33 B1: origen de la venta para el filtro de Pagos por validar. */
  origin: string;
  isLive: boolean;
  /** Venta que Pau cerró en el chat del CRM. */
  isCrm: boolean;
  /** Comprobante del CRM cuya venta no está entre los pedidos cargados. */
  withoutOrder?: boolean;
}

const CRM_ORIGIN = "CRM · Pau";

type PaymentOrigin = "todos" | "live" | "otros" | "pau";
const PAYMENT_ORIGINS: [PaymentOrigin, string][] = [
  ["todos", "Todos"],
  ["live", "POWIP Live y Link"],
  ["otros", "Otros orígenes"],
  // Ventas que Pau cerró en el CRM: son un origen más de la misma tabla (25-nov).
  ["pau", CRM_ORIGIN],
];
const prettyOrigin = (value?: string | null) =>
  value ? value.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) : "—";
function saleOrigin(order: OrderHeader) {
  if (order.externalSource === "POWIP_LIVE")
    return order.closingChannel === "POWIP_LINK" ? "POWIP Link" : "POWIP Live";
  if (order.externalSource === "crm_pau") return CRM_ORIGIN;
  return prettyOrigin(order.externalSource || order.salesChannel);
}

/** Forma mínima de una guía de ms-courier usada solo para enriquecer la tabla. */
interface ShippingGuideLite {
  id: string;
  orderIds?: string[];
  deliveryType?: string;
  courierName?: string;
}

/* -----------------------------------------
   Mapper
----------------------------------------- */

function mapOrderToSale(order: OrderHeader): Sale {
  const total = Number(order.grandTotal);
  // `/leads-cod` puede devolver un DTO más liviano — se protege cada acceso.
  const payments = order.payments ?? [];
  const customer = order.customer ?? null;
  const advancePayment = payments
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const pendingPayment = Math.max(total - advancePayment, 0);

  // Calcular pagos pendientes de aprobación
  const pendingPayments = payments.filter((p) => p.status === "PENDING");
  const pendingPaymentsAmount = pendingPayments.reduce(
    (acc, p) => acc + Number(p.amount || 0),
    0,
  );

  return {
    id: order.id,
    currency: order.currency, commercialStage: order.commercialStage, commercialLeadId: order.commercialLeadId, commercialStockState: order.commercialStockState,
    unitAssignmentStatus: order.unitAssignmentStatus,
    unitCatalogValidated: order.unitCatalogValidated,
    hasTrackedUnits: order.hasTrackedUnits,
    stockVersion: order.stockVersion,
    confirmedStockVersion: order.confirmedStockVersion,
    items: order.items,
    storeId: order.storeId,
    inventoryId: order.inventoryId,
    stockStoreId: order.stockStoreId,
    orderNumber: order.orderNumber,
    clientName: customer?.fullName ?? "—",
    phoneNumber: customer?.phoneNumber ?? "999",
    documentType: customer?.documentType ?? null,
    documentNumber: customer?.documentNumber ?? null,
    date: order.created_at
      ? new Date(order.created_at).toLocaleDateString("es-AR")
      : "",
    total,
    status: order.status,
    paymentMethod: payments.length > 0 ? payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType?.replace("_", " ") ?? "—",
    salesRegion: order.salesRegion,
    district: customer?.district ?? "",
    address: customer?.address ?? "",
    googleMapsUrl: customer?.googleMapsUrl ?? null,
    advancePayment,
    pendingPayment,
    courier: order.courier ?? null,
    hasPendingPayments: pendingPayments.length > 0,
    pendingPaymentsCount: pendingPayments.length,
    pendingPaymentsAmount,
    city: customer?.city ?? customer?.district ?? "",
    province: customer?.province ?? "",
    zone: customer?.zone ?? "",
    paymentCreatedAt:
      pendingPayments.length > 0
        ? (pendingPayments[0].created_at?.toString() ?? null)
        : null,
    sellerName: order.sellerName ?? null,
    externalSource: saleSourceKey(order),
    externalId: order.externalId ?? null,
    subEstadoCc: order.subEstadoCc ?? null,
    origin: saleOrigin(order),
    isLive: order.externalSource === "POWIP_LIVE",
    isCrm: order.externalSource === "crm_pau",
  };
}

/** Fila para un comprobante del CRM sin pedido a la vista: no se inventan datos que no trae. */
function receiptToSale(receipt: PaymentReceipt): Sale {
  const total = Number(receipt.pauSale?.total ?? receipt.amount);
  return {
    id: receipt.orderId ?? `crm-receipt:${receipt.id}`,
    storeId: "",
    orderNumber: receipt.orderNumber ?? "Sin pedido",
    clientName: receipt.pauSale?.customerName ?? "Cliente del chat",
    phoneNumber: "",
    date: receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString("es-AR") : "",
    total,
    status: "PENDIENTE",
    paymentMethod: receipt.method,
    deliveryType: "—",
    salesRegion: "" as Sale["salesRegion"],
    district: receipt.pauSale?.district ?? "",
    address: "",
    advancePayment: 0,
    pendingPayment: total,
    courier: null,
    hasPendingPayments: true,
    pendingPaymentsCount: 1,
    pendingPaymentsAmount: Number(receipt.amount),
    city: receipt.pauSale?.district ?? "",
    paymentCreatedAt: receipt.createdAt ?? null,
    sellerName: "Pau",
    origin: CRM_ORIGIN,
    isLive: false,
    isCrm: true,
    withoutOrder: true,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function FinanzasPage() { return <Suspense fallback={<PowipPulseLoader label="Cargando Finanzas…" />}><FinanzasContent /></Suspense>; }

function FinanzasContent() {

  // Filtros avanzados
  const [filtersPagosPendientes, setFiltersPagosPendientes] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersEntregado, setFiltersEntregado] =
    useState<SalesFilters>(emptySalesFilters);
  const [isPrinting, setIsPrinting] = useState(false);

  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(
    new Set(),
  );

  // Estado para modal de cancelación
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Estado para modal de comentarios
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedSaleForComments, setSelectedSaleForComments] =
    useState<Sale | null>(null);

  // Estado para modal de pagos
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] =
    useState<Sale | null>(null);

  const { auth } = useAuth();
  const printScope = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`;
  const activePrintScope = useRef(printScope);
  activePrintScope.current = printScope;
  const printEpoch = useRef(0);
  const printWindows = useRef(new Set<Window>());
  useEffect(() => {
    setIsPrinting(false);
    setSelectedSaleIds(new Set());
    return () => {
      printEpoch.current += 1;
      for (const win of printWindows.current) win.close();
      printWindows.current.clear();
    };
  }, [printScope]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLeadId = searchParams.get("leadId") ?? "";
  const [leadPaymentsOpen, setLeadPaymentsOpen] = useState(searchParams.get("tab") === "anticiposLeads");
  // FEAT-33 B1: la consola de Live abre `?tab=pagos&origen=live`, ya filtrado.
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get("tab");
    return requested === "entregados" || requested === "liquidacionesCourier" ? requested : "pagosPendientes";
  });
  const [paymentOrigin, setPaymentOrigin] = useState<PaymentOrigin>(() => {
    const requested = searchParams.get("origen");
    return requested === "live" || requested === "otros" || requested === "pau" ? requested : "todos";
  });
  const [liveDecision, setLiveDecision] = useState<{
    storeId: string;
    review: LiveYapeReview;
    decision: "approve" | "reject";
  } | null>(null);

  const { storeIds, canFetch, scopeKey } = useBusinessScope();
  const ordersQuery = useBusinessOrders(undefined, undefined, {includeCcLeads: true, includeCommercialLeads: true});
  const invalidateBusinessData = useInvalidateBusinessData();
  const guidesQuery = useBusinessGuides<ShippingGuideLite>();
  // Los leads COD confirmados/reprogramados siguen participando en revisión de pagos.
  const leadsQuery = useQuery({
    queryKey: ["business-finance-cod-leads", scopeKey],
    enabled: canFetch,
    queryFn: async ({ signal }) => {
      const responses = await Promise.all(storeIds.map((storeId) => axiosAuth.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${storeId}/leads-cod`, { signal },
      )));
      return responses.flatMap((response) => response.data ?? []);
    },
    retry: false,
  });
  // 2do filtro de las ventas de Pau: el comprobante ya pasó el 1er filtro de Pau en el CRM.
  const crmPauQuery = useCrmPauReceipts(canFetch);
  const crmPauReceipts = crmPauQuery.data;
  const receiptsBySaleId = useMemo(() => {
    const map = new Map<string, PaymentReceipt[]>();
    for (const receipt of crmPauReceipts ?? []) {
      const key = receipt.orderId ?? `crm-receipt:${receipt.id}`;
      map.set(key, [...(map.get(key) ?? []), receipt]);
    }
    return map;
  }, [crmPauReceipts]);
  // FEAT-33 A9/D4: el detalle Yape (operación y plazo) de cada comprobante Live en revisión.
  const canReviewLive = canReviewLivePayments(auth?.user);
  const liveReviewsQuery = useQuery({
    queryKey: ["finance-live-reviews", scopeKey],
    enabled: canFetch && canReviewLive,
    queryFn: async ({ signal }) => {
      const results = await Promise.allSettled(
        storeIds.map((storeId) =>
          getLiveYapeReviews(storeId, signal).then((result) =>
            result.reviews.map((review) => ({ storeId, review })),
          ),
        ),
      );
      return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    },
    retry: false,
  });
  const liveReviewByOrder = useMemo(
    () =>
      new Map(
        (liveReviewsQuery.data ?? []).flatMap((entry) =>
          entry.review.orderId ? [[entry.review.orderId, entry] as const] : [],
        ),
      ),
    [liveReviewsQuery.data],
  );
  const refetchLiveReviews = liveReviewsQuery.refetch;
  const loading = ordersQuery.loading || (canFetch && leadsQuery.isPending) || guidesQuery.loading;
  const loadError = ordersQuery.error || leadsQuery.isError;
  const sales = useMemo(() => {
    if (loadError) return [];
    const ordersById = new Map<string, OrderHeader>();
    ordersQuery.orders.forEach((order) => ordersById.set(order.id, order));
    (leadsQuery.data ?? []).forEach((order) => ordersById.set(order.id, order));
    const guideMap = new Map<string, ShippingGuideLite>();
    guidesQuery.guides.forEach((guide) => guide.orderIds?.forEach((id) => guideMap.set(id, guide)));
    return Array.from(ordersById.values()).map(mapOrderToSale).filter((sale) => sale.status !== "ANULADO").map((sale) => {
      const guide = guideMap.get(sale.id);
      return { ...sale, shippingDeliveryType: guide?.deliveryType, shippingCourierName: guide?.courierName };
    });
  }, [ordersQuery.orders, leadsQuery.data, guidesQuery.guides, loadError]);
  const refetchOrders = ordersQuery.refetch;
  const refetchGuides = guidesQuery.refetch;
  const refetchLeads = leadsQuery.refetch;
  const fetchOrders = useCallback(() => {
    void refetchOrders();
    void refetchGuides();
    void refetchLeads();
    void invalidateBusinessData();
  }, [refetchOrders, refetchGuides, refetchLeads, invalidateBusinessData]);
  useEffect(() => { setSelectedSaleIds(new Set()); }, [scopeKey]);
  useEffect(() => { if (loadError) toast.error("No se pudieron cargar los datos de Finanzas. Reintentá."); }, [loadError]);
  useEffect(() => {
    if (guidesQuery.error) toast.warning("No se pudo cargar info de couriers; el resto de Finanzas está disponible.");
  }, [guidesQuery.error]);

  useEffect(() => {
    const refresh = (event: Event) => { if (auth?.company?.id && (event as CustomEvent<{companyId?: string}>).detail?.companyId === auth.company.id) fetchOrders(); };
    window.addEventListener("commercial-leads:changed", refresh);
    return () => window.removeEventListener("commercial-leads:changed", refresh);
  }, [auth?.company?.id, fetchOrders]);

  // Helper: info del usuario actual para trazabilidad
  const getUserInfo = useCallback(
    () => ({
      userId: auth?.user?.id,
      sellerName:
        [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ") ||
        undefined,
    }),
    [auth?.user],
  );

  const handleChangeStatus = useCallback(
    async (
      saleId: string,
      newStatus: OrderStatus,
      cancellationReason?: CancellationReason,
    ) => {
      if (sales.find((sale) => sale.id === saleId)?.commercialStage === "LEAD") { toast.error("Gestiona la compra desde el Lead; el pago no confirma la venta."); return; }
      // Si el nuevo estado es ANULADO y no hay motivo, abrir modal
      if (newStatus === "ANULADO" && !cancellationReason) {
        const sale = sales.find((s) => s.id === saleId);
        if (sale) {
          setSaleToCancel(sale);
          setCancellationModalOpen(true);
        }
        return;
      }

      try {
        const payload: Record<string, unknown> = {
          status: newStatus,
          ...getUserInfo(),
        };
        if (cancellationReason) {
          payload.cancellationReason = cancellationReason;
        }

        await axiosAuth.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleId}`,
          payload,
        );
        toast.success(`Estado actualizado a ${newStatus}`);
        fetchOrders();
      } catch (error) {
        console.error("Error actualizando estado", error);
        toast.error("No se pudo actualizar el estado");
      }
    },
    [sales, fetchOrders, getUserInfo],
  );

  const handleConfirmCancellation = useCallback(
    async (reason: CancellationReason, notes?: string) => {
      if (!saleToCancel || saleToCancel.commercialStage === "LEAD") return;

      setIsCancelling(true);
      try {
        await axiosAuth.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleToCancel.id}`,
          {
            status: "ANULADO",
            cancellationReason: reason,
            ...getUserInfo(),
          },
        );
        toast.success(`Venta ${saleToCancel.orderNumber} anulada`);
        setCancellationModalOpen(false);
        setSaleToCancel(null);
        fetchOrders();
      } catch (error) {
        console.error("Error anulando venta", error);
        toast.error("No se pudo anular la venta");
      } finally {
        setIsCancelling(false);
      }
    },
    [saleToCancel, fetchOrders, getUserInfo],
  );

  const toggleSale = useCallback((id: string) => {
    setSelectedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleWhatsApp = (
    phoneNumber: string,
    orderNumber?: string,
    clientName?: string,
    pendingAmount?: number,
    currency?: string | null,
  ) => {
    const cleanPhone = toWhatsAppDigits(phoneNumber);

    let message = `Hola${clientName ? ` ${clientName}` : ""}! `;
    if (orderNumber) {
      const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}`;
      message += `Te contactamos por tu pedido ${orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}\n\n`;
    }
    if (pendingAmount && pendingAmount > 0) {
      message += `Tienes un pago pendiente de ${formatSalesMoney(pendingAmount,currency)} por verificar.`;
    }

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const handleBulkWhatsApp = (salesList: Sale[]) => {
    const selectedSales = salesList.filter((s) => selectedSaleIds.has(s.id));

    if (selectedSales.length === 0) {
      toast.warning(
        "No hay pedidos seleccionados en esta vista para enviar WhatsApp",
      );
      return;
    }

    if (selectedSales.length > 5) {
      toast.info(
        `Se abrirán ${selectedSales.length} ventanas de WhatsApp. Asegúrate de permitir las ventanas emergentes (pop-ups).`,
      );
    } else {
      toast.success(
        `Preparando envío múltiple a ${selectedSales.length} clientes...`,
      );
    }

    selectedSales.forEach((sale, index) => {
      setTimeout(() => {
        handleWhatsApp(
          sale.phoneNumber,
          sale.orderNumber,
          sale.clientName,
          sale.pendingPayment,
          sale.currency,
        );
      }, index * 600);
    });
  };

  const handleCopySelected = async (salesList: Sale[]) => {
    const selectedSales = salesList.filter((s) => selectedSaleIds.has(s.id));

    if (selectedSales.length === 0) {
      toast.warning("No hay pedidos seleccionados en esta vista");
      return;
    }

    const text = selectedSales
      .map((sale) => {
        const mapsLine = formatGoogleMapsClipboardLine(sale.googleMapsUrl);
        return `
${sale.commercialStage === "LEAD" ? "Lead" : "Venta"} ${sale.orderNumber}
Cliente: ${sale.clientName}
Teléfono: ${sale.phoneNumber}
Distrito: ${sale.district}
Dirección: ${sale.address}${mapsLine ? `\n${mapsLine}` : ""}
Fecha: ${sale.date}
Total: ${formatSalesMoney(sale.total,sale.currency)}
Adelanto: ${formatSalesMoney(sale.advancePayment,sale.currency)}
Por Cobrar: ${formatSalesMoney(sale.pendingPayment,sale.currency)}
Estado: ${sale.status}
`.trim();
      })
      .join("\n\n--------------------\n\n");

    await navigator.clipboard.writeText(text);
    toast.success(`${selectedSales.length} pedido(s) copiados`);
  };

  // Exportar a Excel (XLSX)
  const handleExportExcel = (salesList: Sale[], tabName: string) => {
    if (salesList.length === 0) {
      toast.warning("No hay datos para exportar");
      return;
    }

    const exportData: SaleExportData[] = salesList.map((s) => ({
      commercialStage:s.commercialStage, commercialLeadId:s.commercialLeadId, currency:s.currency,
      orderNumber: s.orderNumber,
      storeId: s.storeId,
      storeName: auth?.company?.stores?.find((store) => store.id === s.storeId)?.name,
      inventoryId: s.inventoryId,
      stockStoreId: s.stockStoreId,
      clientName: s.clientName,
      phoneNumber: s.phoneNumber,
      documentType: s.documentType,
      documentNumber: s.documentNumber,
      date: s.date,
      total: s.total,
      advancePayment: s.advancePayment,
      pendingPayment: s.pendingPayment,
      status: s.status,
      salesRegion: s.salesRegion,
      province: s.province,
      city: s.city,
      district: s.district,
      zone: s.zone,
      address: s.address,
      googleMapsUrl: s.googleMapsUrl,
      paymentMethod: s.paymentMethod,
      deliveryType: s.deliveryType,
      courier: s.courier,
    }));

    exportSalesToExcel(exportData, `finanzas_${tabName}`);
    toast.success(`Exportados ${salesList.length} registros`);
  };

  // Impresión masiva genérica
  const handleBulkPrintForStatus = async (salesList: Sale[]) => {
    const selectedSales = salesList.filter((s) => selectedSaleIds.has(s.id));
    if (selectedSales.some((sale) => sale.commercialStage === "LEAD")) { toast.error("Los Leads no emiten comprobantes de venta. Consulta sus pagos desde la bandeja."); return; }

    if (selectedSales.length === 0) {
      toast.warning("No hay pedidos seleccionados para imprimir");
      return;
    }

    // Abrir la ventana ANTES de cualquier await: si se abre después de
    // esperar las requests de abajo, el navegador la bloquea en silencio.
    const printWindow = openPrintWindow();
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión. Verifica que los popups no estén bloqueados.");
      return;
    }
    printWindows.current.add(printWindow);
    const epoch = printEpoch.current;
    const isCurrent = () => epoch === printEpoch.current && printScope === activePrintScope.current;

    setIsPrinting(true);
    toast.info(`Preparando ${selectedSales.length} recibo(s) para imprimir...`);

    try {
      const receipts = await Promise.all(
        selectedSales.map(async (sale) => {
          const res = await axiosAuth.get<ReceiptData>(
            saleReceiptUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", sale.id, sale),
          );
          if (res.data?.orderId !== sale.id) throw new Error("El comprobante no corresponde al pedido seleccionado.");
          return res.data;
        }),
      );

      // Imprimir usando la utilidad compartida (formato compacto con QR)
      if (!isCurrent()) return;
      await printReceipts(receipts, auth?.company, printWindow, isCurrent);
      if (!isCurrent()) return;

      toast.success(`${selectedSales.length} recibo(s) enviados a imprimir`);
      setSelectedSaleIds(new Set());
    } catch (error) {
      printWindow.close();
      if (!isCurrent()) return;
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
    } finally {
      printWindows.current.delete(printWindow);
      if (isCurrent()) setIsPrinting(false);
    }
  };

  // Tabla para Despachados (con select de estado)
  const renderDespachadosTable = (data: Sale[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px] min-w-[40px]">
            <input
              type="checkbox"
              checked={
                data.length > 0 && data.every((s) => selectedSaleIds.has(s.id))
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSaleIds(
                    (prev) => new Set([...prev, ...data.map((s) => s.id)]),
                  );
                } else {
                  setSelectedSaleIds((prev) => {
                    const next = new Set(prev);
                    data.forEach((s) => next.delete(s.id));
                    return next;
                  });
                }
              }}
            />
          </TableHead>
          <TableHead className="w-[100px] min-w-[100px]">N° Orden</TableHead>
          <TableHead className="lg:sticky lg:left-0 w-[160px] min-w-[160px] lg:z-20 bg-background border-r">
            Cliente
          </TableHead>
          <TableHead className="lg:sticky lg:left-[160px] w-[120px] min-w-[120px] lg:z-20 bg-background border-r">
            Teléfono
          </TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Fecha</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Pago</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Envío</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Total</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Adelanto</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Por Cobrar</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Enviado Por</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Estado</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Region</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Resumen</TableHead>
          <TableHead className="lg:sticky lg:right-0 w-[100px] min-w-[100px] lg:z-20 bg-background text-right border-l">
            Acciones
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="w-[40px] min-w-[40px]">
              <input
                type="checkbox"
                checked={selectedSaleIds.has(sale.id)}
                onChange={() => toggleSale(sale.id)}
              />
            </TableCell>
            <TableCell className="font-medium w-[100px] min-w-[100px]">
              {sale.orderNumber}
              {sale.commercialStage === "LEAD" && <Link className="block text-xs underline" href={sale.commercialLeadId ? commercialLeadHref(sale.commercialLeadId) : "/leads-comerciales"}>Lead pendiente de compra</Link>}
            </TableCell>
            <TableCell className="lg:sticky lg:left-0 w-[160px] min-w-[160px] lg:z-10 bg-background border-r">
              {sale.clientName}
            </TableCell>
            <TableCell className="lg:sticky lg:left-[160px] w-[120px] min-w-[120px] lg:z-10 bg-background border-r">
              {sale.phoneNumber}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              {sale.date}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              {sale.paymentMethod}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              {sale.deliveryType}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              ${sale.total.toFixed(2)}
            </TableCell>
            <TableCell className="text-green-600 w-[100px] min-w-[100px]">
              ${sale.advancePayment.toFixed(2)}
            </TableCell>
            <TableCell className="text-red-600 w-[100px] min-w-[100px]">
              ${sale.pendingPayment.toFixed(2)}
            </TableCell>
            <TableCell className="text-xs w-[120px] min-w-[120px]">
              {sale.sellerName || "—"}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              {sale.courier || "—"}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              <select
                value={sale.status}
                disabled={sale.commercialStage === "LEAD"}
                onChange={(e) =>
                  handleChangeStatus(sale.id, e.target.value as OrderStatus)
                }
                className="border rounded-md px-2 py-1 text-sm bg-background text-foreground w-full"
              >
                {getAvailableStatuses(sale.status, sale.salesRegion).map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ),
                )}
              </select>
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              {sale.salesRegion}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              <OrderDetailButton
                orderId={sale.id}
                orderNumber={sale.orderNumber}
              />
            </TableCell>
            <TableCell className="text-right lg:sticky lg:right-0 w-[100px] min-w-[100px] lg:z-10 bg-background border-l">
              <div className="flex gap-1 justify-end">
                <Button
                  size="icon"
                  variant="outline"
                  className="bg-green-500 hover:bg-green-600 text-white border-green-600"
                  title="WhatsApp"
                  onClick={() =>
                    handleWhatsApp(
                      sale.phoneNumber,
                      sale.orderNumber,
                      sale.clientName,
                    )
                  }
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="relative bg-amber-50 hover:bg-amber-100 text-amber-600"
                  onClick={() => {
                    setSelectedSaleForPayment(sale);
                    setPaymentModalOpen(true);
                  }}
                  title={
                    sale.hasPendingPayments
                      ? "Pagos pendientes de aprobación"
                      : "Gestión de Pagos"
                  }
                >
                  <DollarSign className="h-4 w-4" />
                  {sale.hasPendingPayments && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    router.push(`/registrar-venta?orderId=${sale.id}`)
                  }
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={15}
              className="text-center text-muted-foreground py-6"
            >
              No hay ventas en este estado
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  // Tabla para Entregados (sin select de estado, solo badge)
  const renderEntregadosTable = (data: Sale[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px] min-w-[40px]">
            <input
              type="checkbox"
              checked={
                data.length > 0 && data.every((s) => selectedSaleIds.has(s.id))
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSaleIds(
                    (prev) => new Set([...prev, ...data.map((s) => s.id)]),
                  );
                } else {
                  setSelectedSaleIds((prev) => {
                    const next = new Set(prev);
                    data.forEach((s) => next.delete(s.id));
                    return next;
                  });
                }
              }}
            />
          </TableHead>
          <TableHead className="w-[100px] min-w-[100px]">N° Orden</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">ID Externo</TableHead>
          <TableHead className="lg:sticky lg:left-0 w-[160px] min-w-[160px] lg:z-20 bg-background border-r">
            Cliente
          </TableHead>
          <TableHead className="lg:sticky lg:left-[160px] w-[120px] min-w-[120px] lg:z-20 bg-background border-r">
            Teléfono
          </TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Fecha</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Pago</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Envío</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Total</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Adelanto</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Por Cobrar</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Vendedor</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Enviado Por</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Tipo Envío</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Courier</TableHead>
          <TableHead className="w-[120px] min-w-[120px]">Estado</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Region</TableHead>
          <TableHead className="w-[100px] min-w-[100px]">Resumen</TableHead>
          <TableHead className="lg:sticky lg:right-0 w-[100px] min-w-[100px] lg:z-20 bg-background text-right border-l">
            Acciones
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="w-[40px] min-w-[40px]">
              <input
                type="checkbox"
                checked={selectedSaleIds.has(sale.id)}
                onChange={() => toggleSale(sale.id)}
              />
            </TableCell>
            <TableCell className="font-medium w-[100px] min-w-[100px]">
              {sale.orderNumber}
              {sale.commercialStage === "LEAD" && <Link className="block text-xs underline" href={sale.commercialLeadId ? commercialLeadHref(sale.commercialLeadId) : "/leads-comerciales"}>Lead pendiente de compra</Link>}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px] text-xs text-muted-foreground truncate max-w-[100px]">
              {sale.externalId || "-"}
            </TableCell>
            <TableCell className="lg:sticky lg:left-0 w-[160px] min-w-[160px] lg:z-10 bg-background border-r">
              {sale.clientName}
            </TableCell>
            <TableCell className="lg:sticky lg:left-[160px] w-[120px] min-w-[120px] lg:z-10 bg-background border-r">
              {sale.phoneNumber}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              {sale.date}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              {sale.paymentMethod}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              {sale.deliveryType}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              ${sale.total.toFixed(2)}
            </TableCell>
            <TableCell className="text-green-600 w-[100px] min-w-[100px]">
              ${sale.advancePayment.toFixed(2)}
            </TableCell>
            <TableCell className="text-red-600 w-[100px] min-w-[100px]">
              ${sale.pendingPayment.toFixed(2)}
            </TableCell>
            <TableCell className="text-xs w-[120px] min-w-[120px]">
              {sale.sellerName || "—"}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              {sale.courier || "—"}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              {sale.shippingDeliveryType || "—"}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              {sale.shippingCourierName || "—"}
            </TableCell>
            <TableCell className="w-[120px] min-w-[120px]">
              <Badge variant="default" className="bg-green-600">
                ENTREGADO
              </Badge>
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              {sale.salesRegion}
            </TableCell>
            <TableCell className="w-[100px] min-w-[100px]">
              <OrderDetailButton
                orderId={sale.id}
                orderNumber={sale.orderNumber}
              />
            </TableCell>
            <TableCell className="text-right lg:sticky lg:right-0 w-[100px] min-w-[100px] lg:z-10 bg-background border-l">
              <div className="flex gap-1 justify-end">
                <Button
                  size="icon"
                  variant="outline"
                  className="bg-green-500 hover:bg-green-600 text-white border-green-600"
                  title="WhatsApp"
                  onClick={() =>
                    handleWhatsApp(
                      sale.phoneNumber,
                      sale.orderNumber,
                      sale.clientName,
                    )
                  }
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    router.push(`/registrar-venta?orderId=${sale.id}`)
                  }
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={17}
              className="text-center text-muted-foreground py-6"
            >
              No hay ventas en este estado
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  /* -----------------------------------------
     Filters
  ----------------------------------------- */

  // Ventas con pagos pendientes de aprobación
  // Una fila por venta: si el CRM tiene su comprobante, se usa la misma fila (nunca dos).
  const pagosPendientes = useMemo(() => {
    const filtered = sales.filter(
      (s) =>
        receiptsBySaleId.has(s.id) ||
        (s.hasPendingPayments &&
        (s.commercialStage === "LEAD" ? s.status !== "ANULADO" : !PAGOS_PENDIENTES_EXCLUDED_STATUSES.includes(s.status)) &&
        // Una venta confirmada por el vendedor (SALE) conserva su subestado de CC hasta que CC
        // confirma el despacho; su pago ya es de una venta real y /ventas lo muestra.
        (s.commercialStage === "LEAD" || s.commercialStage === "SALE" || !s.subEstadoCc || CC_CONFIRMED_SUBESTADOS.includes(s.subEstadoCc))),
    );
    const listed = new Set(filtered.map((s) => s.id));
    const rows: Sale[] = filtered.map((s) => {
      const receipts = receiptsBySaleId.get(s.id);
      if (!receipts) return s;
      return {
        ...s,
        origin: CRM_ORIGIN,
        isCrm: true,
        pendingPaymentsCount: s.pendingPaymentsCount || receipts.length,
        pendingPaymentsAmount: s.pendingPaymentsAmount || receipts.reduce((sum, r) => sum + Number(r.amount), 0),
        paymentCreatedAt: s.paymentCreatedAt ?? receipts[0].createdAt ?? null,
      };
    });
    for (const [key, receipts] of receiptsBySaleId) {
      if (!listed.has(key)) rows.push(receiptToSale(receipts[0]));
    }
    return applyFilters(rows, filtersPagosPendientes);
  }, [sales, receiptsBySaleId, filtersPagosPendientes]);
  const pagosPorValidar = useMemo(
    () =>
      pagosPendientes.filter((sale) =>
        paymentOrigin === "todos" ? true
          : paymentOrigin === "live" ? sale.isLive
          : paymentOrigin === "pau" ? sale.isCrm
          : !sale.isLive && !sale.isCrm,
      ),
    [pagosPendientes, paymentOrigin],
  );

  const entregados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.commercialStage !== "LEAD" && s.status === ORDER_STATUS.ENTREGADO,
    );
    return applyFilters(statusFiltered, filtersEntregado);
  }, [sales, filtersEntregado]);

  // Extraer lista de couriers únicos para el filtro
  const availableCouriers = useMemo(() => {
    const couriers = sales
      .map((s) => s.courier)
      .filter((c): c is string => !!c);
    return [...new Set(couriers)];
  }, [sales]);

  return (
    <OrderDetailModalProvider onOrderUpdated={fetchOrders} hideCallManagement>
      <div className="flex h-screen w-full">
        <main className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex flex-col items-center mb-6">
            <Button variant="outline" onClick={() => setLeadPaymentsOpen((open) => !open)}>Anticipos de Leads</Button>
            <HeaderConfig
              title="Finanzas"
              description="Pagos de ventas, anticipos de Leads y liquidaciones"
            />
          </div>

          {leadPaymentsOpen && <LeadPaymentsTab requestedLeadId={requestedLeadId} onPaymentUpdated={fetchOrders} />}
          {/* Tabs para Finanzas */}
          {loading ? (
            <PowipPulseLoader label="Cargando finanzas..." />
          ) : loadError ? (
            <div role="alert" className="space-y-3"><p>No se pudieron cargar los datos de Finanzas del alcance seleccionado.</p><Button onClick={fetchOrders}>Reintentar</Button></div>
          ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="pagosPendientes">
                Pagos por validar ({pagosPendientes.length})
              </TabsTrigger>
              <TabsTrigger value="entregados">
                Entregados ({entregados.length})
              </TabsTrigger>
              <TabsTrigger value="liquidacionesCourier">
                Liquidaciones Courier
              </TabsTrigger>
            </TabsList>

            {/* Tab Pagos por validar (FEAT-33 B1: la única cola de pagos del negocio) */}
            <TabsContent value="pagosPendientes">
              <Card>
                <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Pagos por validar</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Todos los comprobantes del negocio en un solo lugar, también los de POWIP Live, POWIP Link y las ventas que Pau cerró en el chat.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1" aria-label="Origen de la venta">
                      {PAYMENT_ORIGINS.map(([value, label]) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={paymentOrigin === value ? "default" : "outline"}
                          aria-pressed={paymentOrigin === value}
                          onClick={() => setPaymentOrigin(value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                      disabled={
                        pagosPorValidar.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleBulkWhatsApp(pagosPorValidar)}
                    >
                      <WhatsAppIcon className="h-4 w-4 mr-2" />
                      WhatsApp Masivo (
                      {
                        pagosPorValidar.filter((s) => selectedSaleIds.has(s.id))
                          .length
                      }
                      )
                    </Button>
                    {auth?.user?.role === "ADMIN" && (
                      <Button
                        variant="outline"
                        className="w-full lg:w-auto"
                        onClick={() =>
                          handleExportExcel(pagosPorValidar, "pagos_por_validar")
                        }
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {crmPauQuery.isError && (paymentOrigin === "todos" || paymentOrigin === "pau") && (
                    <p role="alert" className="mb-4 text-sm text-muted-foreground">
                      No se pudieron cargar los comprobantes del CRM.
                    </p>
                  )}
                  <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Comprueba cada ingreso en la cuenta del negocio. El comprobante queda pendiente hasta que lo valides o rechaces; en POWIP Live el stock sigue reservado mientras tanto.
                  </p>
                  <SalesTableFilters
                    filters={filtersPagosPendientes}
                    onFiltersChange={setFiltersPagosPendientes}
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px] min-w-[100px]">
                          N° Orden
                        </TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">
                          ID Externo
                        </TableHead>
                        <TableHead className="w-[110px] min-w-[110px]">
                          Origen
                        </TableHead>
                        <TableHead className="lg:sticky lg:left-0 w-[160px] min-w-[160px] lg:z-20 bg-background border-r">
                          Cliente
                        </TableHead>
                        <TableHead className="lg:sticky lg:left-[160px] w-[120px] min-w-[120px] lg:z-20 bg-background border-r">
                          Teléfono
                        </TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">
                          Región
                        </TableHead>
                        <TableHead className="w-[120px] min-w-[120px]">
                          Ciudad
                        </TableHead>
                        <TableHead className="w-[120px] min-w-[120px]">
                          Courier
                        </TableHead>
                        <TableHead className="w-[120px] min-w-[120px]">
                          Estado Venta
                        </TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">
                          Total Venta
                        </TableHead>
                        <TableHead className="w-[140px] min-w-[140px]">
                          Pagos Pendientes
                        </TableHead>
                        <TableHead className="w-[140px] min-w-[140px]">
                          Monto por Aprobar
                        </TableHead>
                        <TableHead className="w-[120px] min-w-[120px]">
                          Vendedor
                        </TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">
                          Fecha Pago
                        </TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">
                          Resumen
                        </TableHead>
                        <TableHead className="lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-20 bg-background text-right border-l">
                          Acciones
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagosPorValidar.map((sale) => {
                        const live = sale.isLive ? liveReviewByOrder.get(sale.id) : undefined;
                        const manual = live?.review.manualPayment;
                        const receipts = receiptsBySaleId.get(sale.id);
                        return (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium w-[100px] min-w-[100px]">
                            {sale.orderNumber}
              {sale.commercialStage === "LEAD" && <Link className="block text-xs underline" href={sale.commercialLeadId ? commercialLeadHref(sale.commercialLeadId) : "/leads-comerciales"}>Lead pendiente de compra</Link>}
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px] text-xs text-muted-foreground truncate max-w-[100px]">
                            {sale.externalId || "-"}
                          </TableCell>
                          <TableCell className="w-[110px] min-w-[110px]">
                            <Badge variant="outline" className={sale.isLive ? "border-violet-200 bg-violet-50 text-violet-700" : undefined}>
                              {sale.origin}
                            </Badge>
                          </TableCell>
                          <TableCell className="lg:sticky lg:left-0 w-[160px] min-w-[160px] lg:z-10 bg-background border-r">
                            {sale.clientName}
                            {receipts?.[0].pauSale?.items && (
                              <span className="block text-xs text-muted-foreground">{receipts[0].pauSale.items}</span>
                            )}
                          </TableCell>
                          <TableCell className="lg:sticky lg:left-[160px] w-[120px] min-w-[120px] lg:z-10 bg-background border-r">
                            {sale.phoneNumber || "-"}
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px]">
                            {sale.salesRegion ? (
                              <Badge
                                variant={
                                  sale.salesRegion === "LIMA"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {sale.salesRegion}
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="w-[120px] min-w-[120px]">
                            {sale.city || "-"}
                          </TableCell>
                          <TableCell className="w-[120px] min-w-[120px]">
                            {sale.courier || "-"}
                          </TableCell>
                          <TableCell className="w-[120px] min-w-[120px]">
                            <Badge variant="outline">{sale.withoutOrder ? "Por validar" : sale.status}</Badge>
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px]">
                            {formatSalesMoney(sale.total, sale.currency)}
                          </TableCell>
                          <TableCell className="w-[140px] min-w-[140px]">
                            <Badge className="bg-amber-100 text-amber-800">
                              {sale.pendingPaymentsCount} pago(s)
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-amber-600 w-[140px] min-w-[140px]">
                            {formatSalesMoney(sale.pendingPaymentsAmount, sale.currency)}
                            {manual ? (
                              <div className="mt-1 space-y-1 text-xs font-normal text-foreground">
                                <p>Operación {manual.operationNumber || "sin número"}</p>
                                {manual.overdue ? (
                                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                                    Plazo vencido · requiere una decisión
                                  </span>
                                ) : manual.reviewDeadlineAt ? (
                                  <p className="text-muted-foreground">
                                    Revisar hasta {new Date(manual.reviewDeadlineAt).toLocaleString("es-PE")}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                            {receipts?.map((receipt) => <CrmPauDetail key={receipt.id} receipt={receipt} />)}
                          </TableCell>
                          <TableCell className="w-[120px] min-w-[120px] text-xs">
                            {sale.sellerName || "—"}
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px]">
                            {sale.paymentCreatedAt
                              ? new Date(
                                  sale.paymentCreatedAt,
                                ).toLocaleDateString("es-PE")
                              : "-"}
                          </TableCell>
                          <TableCell className="w-[100px] min-w-[100px]">
                            {sale.withoutOrder && !receipts?.[0].orderId ? "-" : (
                              <OrderDetailButton
                                orderId={sale.id}
                                orderNumber={sale.orderNumber}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-10 bg-background border-l">
                            <div className={receipts ? "ml-auto flex max-w-[130px] flex-wrap justify-end gap-1" : "flex gap-1 justify-end"}>
                              {sale.phoneNumber && <Button
                                size="icon"
                                variant="outline"
                                className="bg-green-500 hover:bg-green-600 text-white border-green-600"
                                title="WhatsApp"
                                onClick={() =>
                                  handleWhatsApp(
                                    sale.phoneNumber,
                                    sale.orderNumber,
                                    sale.clientName,
                                    sale.pendingPaymentsAmount,
                                    sale.currency,
                                  )
                                }
                              >
                                <WhatsAppIcon className="h-4 w-4" />
                              </Button>}
                              {receipts ? (
                                receipts.map((receipt) => <CrmPauActions key={receipt.id} receipt={receipt} onReviewed={fetchOrders} />)
                              ) : live && canReviewLive && manual?.status === "UNDER_REVIEW" ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => setLiveDecision({ ...live, decision: "approve" })}
                                  >
                                    Revisar y validar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setLiveDecision({ ...live, decision: "reject" })}
                                  >
                                    Rechazar comprobante
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-amber-500 hover:bg-amber-600 text-white"
                                  onClick={() => {
                                    setSelectedSaleForPayment(sale);
                                    setPaymentModalOpen(true);
                                  }}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Gestionar Pagos
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                      {pagosPorValidar.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={16}
                            className="text-center text-muted-foreground py-6"
                          >
                            {paymentOrigin === "pau" ? "No hay ventas de Pau por validar" : "No hay pagos pendientes de aprobación"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
                <Pagination
                  currentPage={1}
                  totalPages={Math.ceil(pagosPorValidar.length / 10) || 1}
                  totalItems={pagosPorValidar.length}
                  itemsPerPage={10}
                  onPageChange={() => {}}
                  itemName="ventas"
                />
              </Card>
            </TabsContent>

            {/* Tab Entregados */}
            <TabsContent value="entregados">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Pedidos Entregados</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={
                        entregados.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0 || isPrinting
                      }
                      onClick={() => handleBulkPrintForStatus(entregados)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir seleccionados (
                      {entregados.filter((s) => selectedSaleIds.has(s.id)).length}
                      )
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        entregados.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleCopySelected(entregados)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar seleccionados (
                      {entregados.filter((s) => selectedSaleIds.has(s.id)).length}
                      )
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                      disabled={
                        entregados.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleBulkWhatsApp(entregados)}
                    >
                      <WhatsAppIcon className="h-4 w-4 mr-2" />
                      WhatsApp Masivo (
                      {entregados.filter((s) => selectedSaleIds.has(s.id)).length}
                      )
                    </Button>
                    {auth?.user?.role === "ADMIN" && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleExportExcel(entregados, "entregados")
                        }
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <SalesTableFilters
                    filters={filtersEntregado}
                    onFiltersChange={setFiltersEntregado}
                    showCourierFilter={true}
                    availableCouriers={availableCouriers}
                  />
                  {renderEntregadosTable(entregados)}
                </CardContent>
                <Pagination
                  currentPage={1}
                  totalPages={Math.ceil(entregados.length / 10) || 1}
                  totalItems={entregados.length}
                  itemsPerPage={10}
                  onPageChange={() => {}}
                  itemName="pedidos"
                />
              </Card>
            </TabsContent>

            {/* Tab Liquidaciones Courier */}
            <TabsContent value="liquidacionesCourier">
              <LiquidacionesCourierTab />
            </TabsContent>
          </Tabs>
          )}
        </main>

        <CancellationModal
          open={cancellationModalOpen}
          onClose={() => {
            setCancellationModalOpen(false);
            setSaleToCancel(null);
          }}
          orderNumber={saleToCancel?.orderNumber || ""}
          onConfirm={handleConfirmCancellation}
          isLoading={isCancelling}
        />

        <CommentsTimelineModal
          open={commentsModalOpen}
          onClose={() => {
            setCommentsModalOpen(false);
            setSelectedSaleForComments(null);
          }}
          orderId={selectedSaleForComments?.id || ""}
          orderNumber={selectedSaleForComments?.orderNumber || ""}
        />

        <PaymentVerificationModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedSaleForPayment(null);
          }}
          orderId={selectedSaleForPayment?.id || ""}
          orderNumber={selectedSaleForPayment?.orderNumber || ""}
          onPaymentUpdated={() => {
            fetchOrders();
            void refetchLiveReviews();
          }}
          canApprove={true}
        />
        {liveDecision ? (
          <ReviewDialog
            key={`${liveDecision.storeId}/${liveDecision.review.checkoutId}/${liveDecision.decision}`}
            storeId={liveDecision.storeId}
            review={liveDecision.review}
            decision={liveDecision.decision}
            onClose={() => setLiveDecision(null)}
            onComplete={() => {
              toast.success(
                liveDecision.decision === "approve"
                  ? "Pago validado. El pedido ya figura como pagado."
                  : "Comprobante rechazado. El cliente verá el motivo en su pedido.",
              );
              setLiveDecision(null);
              fetchOrders();
              void refetchLiveReviews();
            }}
          />
        ) : null}
      </div>
    </OrderDetailModalProvider>
  );
}
