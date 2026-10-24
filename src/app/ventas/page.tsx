"use client";
import { isCommercialSaleOrder, canShipCommercialOrder, salesPhysicalOperationBlockReason, salesStatusBlockReason, commercialLeadHref } from "@/utils/commercialOrders";
import { formatSalesMoney } from "@/utils/salesMoney";
import { deliveryPaymentBlockReason, operationalStatus, orderFinancialState } from "@/utils/orderState";
import { FinancialStatusBadge } from "@/components/shared/FinancialStatusBadge";

import { useSaleLifecycleRouting } from "@/hooks/useSaleLifecycleRouting";
import SaleUnitLifecycleModal from "@/components/registrar-venta/SaleUnitLifecycleModal";
import { type SaleUnitLifecycleAction } from "@/services/saleUnitLifecycleService";
import { assignmentBlockReason, hasUnitAssignment, unitAssignmentLabel, requiresAuthenticatedSaleMutation, saleMutationUrl, saleReceiptUrl, type UnitAssignmentState } from "@/services/saleTrackingService";
import Link from "next/link";
import Image from "next/image";
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Printer,
  AlertTriangle,
  Download,
  Loader2,
  UploadCloud,
  MapPin,
  Clock,
  Ban,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Package,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { ShopifyCancelledBadge } from "@/components/shared/ShopifyCancelledBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { OrderHeader, OrderStatus, OrderItem, type SubEstadoCc } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { useInvalidateBusinessData } from "@/hooks/useInvalidateBusinessData";
import { useBusinessSalesPage } from "@/hooks/useBusinessSalesPage";
import { getBusinessSalesExport, type BusinessSalesOrder, type BusinessSalesQuery, type BusinessSalesTab } from "@/services/businessSalesService";
import {
  daysWithoutMovement,
  isPendienteStatus,
  ventasRecentFrom,
  ventasAntiguosTo,
} from "./ventasTabs";
import { todayInPeru, type DateWindow } from "@/lib/peruDate";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import ImportSalesModal from "@/components/modals/ImportSalesModal";
import { orderDetailButtonClassName } from "@/components/orders/OrderDetailModal";
import { formatGoogleMapsClipboardLine } from "@/components/shared/MapsLink";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import CreateGuideModal, {
  CreateGuideData,
} from "@/components/modals/CreateGuideModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  countProductUnits,
} from "@/components/ventas/SalesTableFilters";
import { Copy, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CancellationModal, {
  CancellationReason,
} from "@/components/modals/CancellationModal";
import {
  getAvailableStatuses,
  ORDER_STATUS_FLOW,
} from "@/utils/domain/orders-status-flow";
import { SaleSecondaryDetails } from "@/components/ventas/SaleSecondaryDetails";
import { StatusSelect } from "@/components/ventas/StatusSelect";
import { openPrintWindow, printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";
import { BulkPrintPreviewDialog } from "@/components/ventas/BulkPrintPreviewDialog";
import CommentsTimelineModal from "@/components/modals/CommentsTimelineModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  exportSalesToExcel,
  formatProductsForExport,
  SaleExportData,
} from "@/utils/exportSalesExcel";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import type { BulkExtraAction } from "@/components/ventas/BulkStatusSelect";
import { processBulkStatusChange } from "@/utils/bulkStatusUtils";
import { RescheduleDialog } from "@/components/ventas/RescheduleDialog";
import {
  enviarPedidoALima,
  reassignSeller,
} from "@/services/atencionClienteService";
import ReassignSellerModal from "@/components/modals/ReassignSellerModal";
import { UserPen } from "lucide-react";

/* -----------------------------------------
   Types
----------------------------------------- */

const ORDER_STATUS = {
  PENDIENTE: "PENDIENTE",
  PAGADO: "PAGADO",
  PREPARADO: "PREPARADO",
  LLAMADO: "LLAMADO",
  EN_ENVIO: "EN_ENVIO",
  ENTREGADO: "ENTREGADO",
  ANULADO: "ANULADO",
};

const ALL_STATUSES: OrderStatus[] = [
  "PENDIENTE",
  "PREPARADO",
  "LLAMADO",
  "EN_ENVIO",
  "ENTREGADO",
  "ANULADO",
];

export interface Sale extends UnitAssignmentState {
  salesOperationalEligible?: boolean;
  shopifyCommercialGate?: boolean | null;
  commercialCommittedAt?: string | null;
  subEstadoCc?: SubEstadoCc | null;
  canalOrigen?: string | null;
  currency?: string | null;
  commercialStage?: "LEAD" | "SALE" | null;
  commercialLeadId?: string | null;
  commercialStockState?: "DEFERRED" | "QUEUED" | "PRESERVED" | "NOT_REQUIRED" | null;

  id: string;
  storeId: string;
  inventoryId?: string | null;
  stockStoreId?: string | null;
  customerId: string;
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
  city: string;
  province: string;
  zone: string;
  address: string;
  googleMapsUrl?: string | null;
  advancePayment: number;
  pendingPayment: number;
  hasStockIssue?: boolean;
  hasPendingApprovalPayments: boolean;
  externalTrackingNumber: string;
  shippingCode: string;
  shippingKey: string;
  shippingOffice: string;
  sellerName: string | null;
  items: OrderItem[];
  externalSource?: string | null;
  shopifyCancelledAt?: string | null;
  shopifyCancelReason?: string | null;
  externalId?: string | null;
  aliclikDispatchStatus?: string | null;
  aliclikSyncedAt?: string | null;
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | "SCHEDULED" | null;
  callbackAt?: string | null;
  /** ISO de order.created_at / order.updated_at: reglas de pestaña y días sin movimiento. */
  createdAt: string;
  updatedAt: string;
}

/** Base de una pestaña mientras su lista no está completa (referencia estable). */
const NO_SALES: Sale[] = [];
const SalesOrderDetailModal = lazy(() => import("@/components/modals/CustomerServiceModal"));

function formatSoles(amount: number): string {
  return `S/ ${amount.toFixed(2)}`;
}

function formatDaysWithoutMovement(days: number): string {
  return `${days} ${days === 1 ? "día" : "días"} sin movimiento`;
}

function formatCallbackAt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}

/** Chip "🔁 fecha" debajo del select de estado — el único lugar donde se ve que un pedido quedó reprogramado. */
function ReprogramadoChip({ sale }: { sale: Pick<Sale, "callStatus" | "callbackAt"> }) {
  if (sale.callStatus !== "SCHEDULED" || !sale.callbackAt) return null;
  return (
    <span className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-violet-600 dark:text-violet-400">
      🔁 {formatCallbackAt(sale.callbackAt)}
    </span>
  );
}

/* -----------------------------------------
   Mapper
----------------------------------------- */

function mapOrderToSale(order: BusinessSalesOrder): Sale {
  const total = Number(order.grandTotal);
  const { totalPaid: advancePayment, pendingAmount: pendingPayment } = orderFinancialState(order);
  const hasPendingApprovalPayments = order.payments.some(
    (p) => p.status === "PENDING",
  );

  return {
    id: order.id,
    salesOperationalEligible: order.salesOperationalEligible,
    shopifyCommercialGate: order.shopifyCommercialGate,
    commercialCommittedAt: order.commercialCommittedAt,
    subEstadoCc: order.subEstadoCc,
    canalOrigen: order.canalOrigen,
    currency: order.currency, commercialStage: order.commercialStage, commercialLeadId: order.commercialLeadId, commercialStockState: order.commercialStockState,
    storeId: order.storeId,
    inventoryId: order.inventoryId,
    stockStoreId: order.stockStoreId,
    customerId: order.customer.id,
    orderNumber: order.orderNumber,
    clientName: order.customer.fullName,
    phoneNumber: order.customer.phoneNumber ?? "999",
    documentType: order.customer.documentType ?? null,
    documentNumber: order.customer.documentNumber ?? null,
    date: new Date(order.created_at).toLocaleDateString("es-AR"),
    total,
    status: operationalStatus(order.status),
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
    salesRegion: order.salesRegion,
    district: order.customer.district ?? "",
    city: order.customer.city ?? "",
    province: order.customer.province ?? "",
    zone: order.customer.zone ?? "",
    address: order.customer.address ?? "",
    googleMapsUrl: order.customer.googleMapsUrl ?? null,
    advancePayment,
    pendingPayment,
    hasStockIssue: order.hasStockIssue ?? false,
    unitAssignmentStatus: order.unitAssignmentStatus,
    unitStockState: order.unitStockState,
    unitCatalogValidated: order.unitCatalogValidated,
    hasTrackedUnits: order.hasTrackedUnits,
    unitAssignmentError: order.unitAssignmentError,
    confirmedStockVersion: order.confirmedStockVersion,
    stockVersion: order.stockVersion,
    hasPendingApprovalPayments,
    externalTrackingNumber: order.externalTrackingNumber || "",
    shippingCode: order.shippingCode || "",
    shippingKey: order.shippingKey || "",
    shippingOffice: order.shippingOffice || "",
    sellerName: order.sellerName ?? null,
    items: order.items || [],
    externalSource: order.externalSource ?? null,
    shopifyCancelledAt: order.shopifyCancelledAt ?? null,
    shopifyCancelReason: order.shopifyCancelReason ?? null,
    externalId: order.externalId ?? null,
    aliclikDispatchStatus: order.aliclikDispatchStatus ?? null,
    aliclikSyncedAt: order.aliclikSyncedAt ?? null,
    callStatus: order.callStatus ?? null,
    callbackAt: order.callbackAt ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

function VentasContent() {
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOrderScope, setDetailOrderScope] = useState("");
  const [salesState, setSales] = useState<Sale[]>([]);
  const [loadedSalesScope, setLoadedSalesScope] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const [createGuideOrder, setCreateGuideOrder] = useState<OrderHeader | null>(
    null,
  );
  const [isCreatingGuide, setIsCreatingGuide] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Filtros avanzados
  const [filtersPendiente, setFiltersPendiente] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersAnulado, setFiltersAnulado] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersAll, setFiltersAll] = useState<SalesFilters>(emptySalesFilters);

  // Rango de fechas para las estadísticas (KPIs), independiente de los
  // filtros de cada tabla
  const [kpiDateFrom, setKpiDateFrom] = useState("");
  const [kpiDateTo, setKpiDateTo] = useState("");
  // Cada pestaña baja solo su período (FEAT-27). "Hoy" en hora de Perú.
  const [today] = useState(() => todayInPeru());
  const [anuladasWindow, setAnuladasWindow] = useState<DateWindow>(() => ({ fromDate: ventasRecentFrom(today), toDate: "" }));
  const [todasWindow, setTodasWindow] = useState<DateWindow>(() => ({ fromDate: ventasRecentFrom(today), toDate: "" }));
  // Pendientes: los recientes (30 días) o los antiguos, que se bajan solo mientras están elegidos
  const [pendientesView, setPendientesView] = useState<"recientes" | "antiguos">("recientes");

  // Paginación para Todas las Ventas
  const [pageAll, setPageAll] = useState(1);
  const [pagePendientes, setPagePendientes] = useState(1);
  const [pageAnulados, setPageAnulados] = useState(1);
  useEffect(() => { setPagePendientes(1); }, [filtersPendiente, pendientesView]);
  useEffect(() => { setPageAnulados(1); }, [filtersAnulado, anuladasWindow]);
  useEffect(() => { setPageAll(1); }, [todasWindow]);
  const ITEMS_PER_PAGE = 10;

  // Estado para modal de cancelación
  const [lifecycle, setLifecycle] = useState<{ orderId: string; action: SaleUnitLifecycleAction } | null>(null);
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

  // Estado para modal de confirmación de impresión
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [pendingPrintSales, setPendingPrintSales] = useState<Sale[]>([]);
  const [pendingPrintScope, setPendingPrintScope] = useState("");

  const [importModalOpen, setImportModalOpen] = useState(false);

  // Estado para alerta de stock bajo/nulo post-impresión
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const [ordersWithStockIssue, setOrdersWithStockIssue] = useState<Sale[]>([]);

  // State for inline tracking field editing
  const [trackingEdits, setTrackingEdits] = useState<
    Record<
      string,
      {
        externalTrackingNumber: string;
        shippingCode: string;
        shippingKey: string;
        shippingOffice: string;
      }
    >
  >({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [sendingLimaId, setSendingLimaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pendientes");

  // Filas con detalle secundario expandido (ID externo, ubicación, tracking)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Estados de selección independientes por pestaña
  const [selectedPendientesIds, setSelectedPendientesIds] = useState<
    Set<string>
  >(new Set());
  const [selectedAnuladosIds, setSelectedAnuladosIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTodasIds, setSelectedTodasIds] = useState<Set<string>>(
    new Set(),
  );

  // Helper para obtener el set actual según la pestaña
  const getSelectedIdsForActiveTab = useCallback(() => {
    if (activeTab === "pendientes") return selectedPendientesIds;
    if (activeTab === "anuladas") return selectedAnuladosIds;
    return selectedTodasIds;
  }, [activeTab, selectedPendientesIds, selectedAnuladosIds, selectedTodasIds]);

  // Helper para setear el set actual según la pestaña
  const setSelectedIdsForActiveTab = useCallback(
    (newSet: Set<string>) => {
      if (activeTab === "pendientes") setSelectedPendientesIds(newSet);
      else if (activeTab === "anuladas") setSelectedAnuladosIds(newSet);
      else setSelectedTodasIds(newSet);
    },
    [activeTab],
  );

  const selectedSaleIds = getSelectedIdsForActiveTab();
  const [pageConfirmados, setPageConfirmados] = useState(1);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [rescheduleDialogSaleId, setRescheduleDialogSaleId] = useState<
    string | null
  >(null);
  const [bulkRescheduleOpen, setBulkRescheduleOpen] = useState(false);

  const [reassignSellerModalOpen, setReassignSellerModalOpen] = useState(false);
  const [saleToReassign, setSaleToReassign] = useState<Sale | null>(null);
  const [isReassigningLoading, setIsReassigningLoading] = useState(false);

  const BULK_ACTION_REPROGRAMAR = "__REPROGRAMAR__";

  const { auth, selectedStoreId } = useAuth();
  const printScope = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}`;
  const activePrintScope = useRef(printScope);
  activePrintScope.current = printScope;
  const printEpoch = useRef(0);
  const printWindows = useRef(new Set<Window>());
  useEffect(() => {
    setPrintPreviewOpen(false);
    setPendingPrintSales([]);
    setIsPrinting(false);
    return () => {
      printEpoch.current += 1;
      for (const win of printWindows.current) win.close();
      printWindows.current.clear();
    };
  }, [printScope]);
  const routeSaleLifecycle = useSaleLifecycleRouting();
  const router = useRouter();

  const { scopeKey, storeIds } = useBusinessScope();
  const activeFilters = activeTab === "pendientes" ? filtersPendiente : activeTab === "anuladas" ? filtersAnulado : filtersAll;
  const activeWindow = activeTab === "pendientes"
    ? pendientesView === "recientes" ? { fromDate: ventasRecentFrom(today), toDate: "" } : { fromDate: "", toDate: ventasAntiguosTo(today) }
    : activeTab === "anuladas" ? anuladasWindow : todasWindow;
  const fromDates = [activeWindow.fromDate, activeFilters.dateFrom].filter(Boolean).sort();
  const toDates = [activeWindow.toDate, activeFilters.dateTo].filter(Boolean).sort();
  const salesQuery: BusinessSalesQuery = {
    ...activeFilters, dateFrom: fromDates.at(-1) || "", dateTo: toDates[0] || "",
    tab: activeTab as BusinessSalesTab,
    page: activeTab === "pendientes" ? pagePendientes : activeTab === "anuladas" ? pageAnulados : pageAll,
    limit: ITEMS_PER_PAGE,
    includeCustomerService: true,
    sort: activeTab === "pendientes" && pendientesView === "antiguos" ? "updated_asc" : "created_desc",
    kpiDateFrom, kpiDateTo,
  };
  const salesScope = JSON.stringify([scopeKey, salesQuery]);
  const pageSessionScope = `${printScope}:${salesScope}`;
  const sales = loadedSalesScope === salesScope ? salesState : NO_SALES;
  const { data: salesPage, isFetching, isDebouncing, isError: salesError, refetch: refetchPage } = useBusinessSalesPage(storeIds, salesQuery);
  const ordersData = salesPage?.data;
  const queryReady = !!salesPage && !isFetching && !isDebouncing && !salesError;
  const queryState = { loading: isFetching || isDebouncing, error: salesError, retry: () => { void refetchPage(); }, ready: queryReady };
  const ventas = {
    ...queryState,
    antiguos: { ...queryState, count: salesPage?.counts?.pendientesAntiguos ?? null },
    anuladas: queryState,
    todas: { ...queryState, count: salesPage?.counts?.todas ?? null },
    kpis: queryState,
  };
  const bulkSelectionReady = queryReady;
  const bulkSelectionScope = salesScope;
  const currentBulkSelection = useRef({ ready: bulkSelectionReady, scope: bulkSelectionScope });
  currentBulkSelection.current = { ready: bulkSelectionReady, scope: bulkSelectionScope };
  const canMutateBulkSelection = () => currentBulkSelection.current.ready && currentBulkSelection.current.scope === bulkSelectionScope;
  // A row may remain readable during a background refetch; writes need a fresh page.
  const currentPageState = useRef({ ready: false, scope: pageSessionScope, sales: new Map<string, Sale>() });
  currentPageState.current = {
    ready: queryReady && loadedSalesScope === salesScope,
    scope: pageSessionScope,
    sales: new Map((ordersData ?? []).map((order) => [order.id, mapOrderToSale(order)])),
  };
  const visibleSale = useCallback((id: string) => {
    const current = currentPageState.current;
    return current.scope === pageSessionScope ? current.sales.get(id) : undefined;
  }, [pageSessionScope]);
  const mutationSale = useCallback((id: string) => currentPageState.current.ready ? visibleSale(id) : undefined, [visibleSale]);
  const canMutateIds = (ids: readonly string[]) => ids.length > 0 && ids.every((id) => !!mutationSale(id));
  const canReadIds = (ids: readonly string[]) => ids.length > 0 && ids.every((id) => !!visibleSale(id));
  const canFulfillIds = (ids: readonly string[]) => canMutateIds(ids) && ids.every((id) => !salesPhysicalOperationBlockReason(mutationSale(id)!));
  const detailOrderIsVisible = !!detailOrderId && detailOrderScope === pageSessionScope && !!visibleSale(detailOrderId);
  useEffect(() => {
    if (detailOrderId && !detailOrderIsVisible) setDetailOrderId(null);
  }, [detailOrderId, detailOrderIsVisible]);
  const todasLoading = ventas.todas.loading;
  const todasError = ventas.todas.error;
  const invalidateBusinessData = useInvalidateBusinessData();
  const refetchOrders = useCallback(() => { void invalidateBusinessData(); }, [invalidateBusinessData]);
  const importStore = auth?.company?.stores?.find((store) => store.id === selectedStoreId);
  const canExport = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  useEffect(() => {
    setSelectedPendientesIds(new Set()); setSelectedAnuladosIds(new Set()); setSelectedTodasIds(new Set()); setExpandedRows(new Set());
  }, [salesScope]);

  useEffect(() => {
    setSelectedPendientesIds(new Set());
    setSelectedAnuladosIds(new Set());
    setSelectedTodasIds(new Set());
    setPageAll(1);
    setPagePendientes(1);
    setPageAnulados(1);
    setCreateGuideOrder(null);
    setImportModalOpen(false);
  }, [scopeKey]);

  // Calcular estados disponibles comunes para la selección de la pestaña activa
  const bulkAvailableStatuses = useMemo(() => {
    const currentSelectedIds = getSelectedIdsForActiveTab();
    if (currentSelectedIds.size === 0) return [];

    const selectedSales = sales.filter((s) => currentSelectedIds.has(s.id));
    if (selectedSales.length === 0) return [];

    // Si hay alguna anulada, no permitimos cambios masivos
    if (selectedSales.some((s) => s.status === "ANULADO")) return [];

    let intersection: OrderStatus[] = [];

    selectedSales.forEach((sale, index) => {
      const nextStatuses = (ORDER_STATUS_FLOW as any)[sale.status] || [];
      const filteredNext = nextStatuses.filter(
        (s: OrderStatus) => s !== "ANULADO" && !salesStatusBlockReason(sale, s),
      );

      if (index === 0) {
        intersection = filteredNext;
      } else {
        intersection = intersection.filter((s) => filteredNext.includes(s));
      }
    });

    return intersection;
  }, [sales, getSelectedIdsForActiveTab]);

  // Sincronizar datos del hook → estado local (permite actualizaciones optimistas locales)
  useEffect(() => {
    if (!ordersData) { setSales([]); return; }

    // INCOMPLETE = carrito/checkout que nunca se terminó (con errores de
    // sync, se repara en Atención al Cliente › Pedidos con errores) — no es
    // una venta real, así que no debe listarse acá (se colaba en "Todas"
    // porque `sales` no filtraba por status).
    const sorted = ordersData.filter((o) => o.status !== "INCOMPLETE" && isCommercialSaleOrder(o));
    const mappedSales = sorted.map(mapOrderToSale);
    setSales(mappedSales);
    setLoadedSalesScope(salesScope);
    const visibleIds = new Set(mappedSales.map((sale) => sale.id));
    setSelectedPendientesIds((ids) => new Set([...ids].filter((id) => visibleIds.has(id))));
    setSelectedAnuladosIds((ids) => new Set([...ids].filter((id) => visibleIds.has(id))));
    setSelectedTodasIds((ids) => new Set([...ids].filter((id) => visibleIds.has(id))));

    // Initialize tracking edits
    const edits: Record<
      string,
      {
        externalTrackingNumber: string;
        shippingCode: string;
        shippingKey: string;
        shippingOffice: string;
      }
    > = {};
    mappedSales.forEach((s) => {
      edits[s.id] = {
        externalTrackingNumber: s.externalTrackingNumber,
        shippingCode: s.shippingCode,
        shippingKey: s.shippingKey,
        shippingOffice: s.shippingOffice,
      };
    });
    setTrackingEdits(edits);
  }, [ordersData, salesScope]);

  // Helper: info del usuario actual para trazabilidad
  const getUserInfo = () => ({
    userId: auth?.user?.id,
    sellerName:
      [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ") ||
      undefined,
  });

  const patchOrder = async (
    orderId: string,
    payload: Record<string, unknown>,
  ) => {
    const sale = mutationSale(orderId);
    if (!sale) throw new Error("Vuelve a cargar el pedido antes de actualizarlo.");
    const targetStatus = typeof payload.status === "string" ? payload.status : "";
    const blocked = salesStatusBlockReason(sale, targetStatus) || assignmentBlockReason(sale, targetStatus) || deliveryPaymentBlockReason(sale.pendingPayment, targetStatus);
    if (blocked) throw new Error(blocked);
    await axiosAuth.patch(
      saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", orderId, sale),
      { ...payload, ...getUserInfo() },
    );
  };

  const handleCreateGuide = async (guidesData: CreateGuideData[]) => {
    if (!canMutateIds(guidesData.flatMap((guide) => guide.orderIds))) return false;
    for (const id of guidesData.flatMap((guide) => guide.orderIds)) {
      const sale = mutationSale(id)!;
      const blocked = salesStatusBlockReason(sale, "ASIGNADO_A_GUIA") || assignmentBlockReason(sale, "ASIGNADO_A_GUIA");
      if (blocked || !canShipCommercialOrder(sale)) { toast.error(blocked || "Esta venta no requiere una guía física."); return false; }
    }
    setIsCreatingGuide(true);
    try {
      for (const guideData of guidesData) {
        for (const id of guideData.orderIds) {
          const sale = mutationSale(id);
          if (!sale) throw new Error("Vuelve a cargar el pedido antes de crear la guía.");
          const blocked = salesStatusBlockReason(sale, "ASIGNADO_A_GUIA") || assignmentBlockReason(sale, "ASIGNADO_A_GUIA");
          if (blocked) throw new Error(blocked);
          if (!canShipCommercialOrder(sale)) throw new Error("Esta venta no requiere una guía física.");
        }
        const guideResponse = await axiosAuth.post(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides`,
          guideData,
        );
        const guideNumber = guideResponse.data.guideNumber;
        for (const orderId of guideData.orderIds) {
          await patchOrder(orderId, {
            guideNumber,
            status: "ASIGNADO_A_GUIA",
            courier: guideData.courierName,
            courierId: guideData.courierId || null,
          });
        }
      }
      toast.success("Guía creada · pedido listo para despacho");
      setCreateGuideOrder(null);
      refetchOrders();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error creando guía");
      return false;
    } finally {
      setIsCreatingGuide(false);
    }
  };

  const handleChangeStatus = async (
    saleId: string,
    newStatus: OrderStatus,
    cancellationReason?: CancellationReason,
  ) => {
    const selectedCommercial = mutationSale(saleId);
    if (!selectedCommercial) return;
    const blocked = salesStatusBlockReason(selectedCommercial, newStatus);
    if (blocked) { toast.error(blocked); return; }
    if (await routeSaleLifecycle(sales.find((sale) => sale.id === saleId), newStatus, (action) => setLifecycle({ orderId: saleId, action }))) return;
    if (!mutationSale(saleId)) return;

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

      await patchOrder(saleId, payload);
      toast.success(`Estado actualizado a ${newStatus}`);
      refetchOrders();
    } catch (error) {
      console.error("Error actualizando estado", error);
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error instanceof Error ? error.message : "No se pudo actualizar el estado"));
    }
  };

  const handleConfirmCancellation = async (
    reason: CancellationReason,
    notes?: string,
  ) => {
    if (!saleToCancel || !mutationSale(saleToCancel.id)) return;
    if (await routeSaleLifecycle(sales.find((sale) => sale.id === saleToCancel.id) ?? saleToCancel, "ANULADO", (action) => {
      setCancellationModalOpen(false);
      setSaleToCancel(null);
      setLifecycle({ orderId: saleToCancel.id, action });
    })) return;
    if (!mutationSale(saleToCancel.id)) return;

    setIsCancelling(true);
    try {
      await axiosAuth.patch(
        saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", saleToCancel.id, saleToCancel),
        {
          status: "ANULADO",
          cancellationReason: reason,
          notes: notes,
          ...getUserInfo(),
        },
      );
      toast.success(`Venta ${saleToCancel.orderNumber} anulada`);
      setCancellationModalOpen(false);
      setSaleToCancel(null);
      refetchOrders();
    } catch (error) {
      console.error("Error anulando venta", error);
      toast.error("No se pudo anular la venta");
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleSale = (id: string) => {
    if (!mutationSale(id)) return;
    const next = new Set(selectedSaleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIdsForActiveTab(next);
  };

  const handleDelete = async (id: string) => {
    if (!mutationSale(id)) return;
    try {
      await axiosAuth.delete(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}`,
      );
      toast.success("Venta eliminada");
      refetchOrders();
    } catch (error) {
      console.error("Error eliminando venta", error);
      toast.error("No se pudo eliminar la venta");
    }
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
Venta ${sale.orderNumber}
Cliente: ${sale.clientName}
Teléfono: ${sale.phoneNumber}
Distrito: ${sale.district}
Dirección: ${sale.address}${mapsLine ? `\n${mapsLine}` : ""}
Fecha: ${sale.date}
Total Venta: ${formatSalesMoney(sale.total, sale.currency)}
Adelanto: ${formatSalesMoney(sale.advancePayment, sale.currency)}
Por Cobrar: ${formatSalesMoney(sale.pendingPayment, sale.currency)}
Estado: ${sale.status}
`.trim();
      })
      .join("\n\n--------------------\n\n");

    await navigator.clipboard.writeText(text);
    toast.success(`${selectedSales.length} pedido(s) copiados`);
  };

  // Exportar a Excel (XLSX)
  const handleExportExcel = async (
    _visibleSales: Sale[], tabName: string, productFilter: string,
  ) => {
    if (isExporting) return;
    setIsExporting(true);
    const controller = new AbortController();
    exportController.current = controller;
    try {
    const salesList = (await getBusinessSalesExport(storeIds, salesQuery, controller.signal)).map(mapOrderToSale);
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
      sellerName: s.sellerName,
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
      products: formatProductsForExport(s.items),
      ...(productFilter && {
        filteredProductUnits: countProductUnits(s.items, productFilter),
      }),
    }));

    exportSalesToExcel(exportData, `ventas_${tabName}`);
    toast.success(`Exportados ${salesList.length} registros`);
    } catch {
      if (!controller.signal.aborted) toast.error("No se pudo completar la exportación. Intenta nuevamente.");
    } finally {
      if (exportController.current === controller) exportController.current = null;
      setIsExporting(false);
    }
  };

  const handleBulkPrint = () => {
    const selectedPendientes = pendientes.filter((s) =>
      selectedSaleIds.has(s.id),
    );

    if (selectedPendientes.length === 0) {
      toast.warning("No hay pedidos seleccionados para imprimir");
      return;
    }
    if (!canMutateIds(Array.from(selectedSaleIds))) return;

    const blocked = selectedPendientes.map((sale) => salesStatusBlockReason(sale, "PREPARADO") || assignmentBlockReason(sale, "PREPARADO")).find(Boolean);
    if (blocked) { toast.error(blocked); return; }
    setPendingPrintSales(selectedPendientes);
    setPendingPrintScope(printScope);
    setPrintPreviewOpen(true);
  };

  const fetchPrintReceipt = useCallback(async (sale: { id: string } & UnitAssignmentState) => {
    const currentSale = mutationSale(sale.id);
    if (!currentSale) throw new Error("Vuelve a cargar el pedido antes de imprimirlo.");
    const blocked = salesPhysicalOperationBlockReason(currentSale);
    if (blocked) throw new Error(blocked);
    const epoch = printEpoch.current;
    const res = await axiosAuth.get<ReceiptData>(
      saleReceiptUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", sale.id, currentSale),
    );
    if (printScope !== activePrintScope.current || epoch !== printEpoch.current)
      throw new Error("La sesión cambió. Vuelve a abrir la vista previa.");
    if (res.data?.orderId !== sale.id) throw new Error("El comprobante no corresponde al pedido seleccionado.");
    return res.data;
  }, [printScope, mutationSale]);

  // Confirmar impresión y cambiar estados
  const handleConfirmPrint = async () => {
    if (pendingPrintSales.length === 0 || pendingPrintScope !== printScope || !canFulfillIds(pendingPrintSales.map((sale) => sale.id))) return;
    const epoch = printEpoch.current;
    const isCurrent = () => epoch === printEpoch.current && printScope === activePrintScope.current;

    setIsPrinting(true);
    let successCount = 0;
    let errorCount = 0;

    // Identificar órdenes con problemas de stock para informar al usuario al final
    const issues = pendingPrintSales.filter((s) => s.hasStockIssue);
    setOrdersWithStockIssue(issues);

    for (const sale of pendingPrintSales) {
      const currentSale = mutationSale(sale.id);
      if (!isCurrent() || !currentSale) { setIsPrinting(false); return; }
      const newStatus = "PREPARADO";
      try {
        const blocked = salesStatusBlockReason(currentSale, newStatus) || assignmentBlockReason(currentSale, newStatus);
        if (blocked) throw new Error(blocked);
        await axiosAuth.patch(
          saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", sale.id, currentSale),
          { status: newStatus, ...getUserInfo() },
        );
        successCount++;
      } catch (error) {
        console.error(`Error actualizando ${sale.orderNumber}`, error);
        errorCount++;
      }
    }
    if (!isCurrent()) return;

    if (successCount > 0) {
      toast.success(`${successCount} pedido(s) actualizados a PREPARADO`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} pedido(s) no pudieron ser actualizados`);
    }

    refetchOrders();
    setSelectedIdsForActiveTab(new Set());
    setIsPrinting(false);

    // Si hubo órdenes con problemas de stock, mostrar el modal de alerta
    if (issues.length > 0) {
      setStockAlertOpen(true);
    }
  };

  const handleClosePrintPreview = () => {
    setPrintPreviewOpen(false);
    setPendingPrintSales([]);
  };

  // Impresión masiva genérica (sin cambiar estado)
  const handleBulkPrintForStatus = async (
    salesList: Sale[],
    statusLabel: string,
  ) => {
    const selectedSales = salesList.filter((s) => selectedSaleIds.has(s.id));

    if (selectedSales.length === 0) {
      toast.warning("No hay pedidos seleccionados para imprimir");
      return;
    }
    if (!canReadIds(selectedSales.map((sale) => sale.id))) return;

    // Abrir la ventana ANTES de cualquier await: si se abre después de
    // esperar las requests de abajo, el navegador la bloquea en silencio.
    const printWindow = openPrintWindow();
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión. Verifica que los popups no estén bloqueados.");
      return;
    }
    printWindows.current.add(printWindow);
    const epoch = printEpoch.current;
    const isPrintSessionCurrent = () => epoch === printEpoch.current && printScope === activePrintScope.current;
    const isCurrent = () => isPrintSessionCurrent() && canReadIds(selectedSales.map((sale) => sale.id));

    setIsPrinting(true);
    toast.info(`Preparando ${selectedSales.length} recibo(s) para imprimir...`);

    try {
      const receipts = await Promise.all(
        selectedSales.map(async (sale) => {
          const currentSale = visibleSale(sale.id);
          if (!currentSale) throw new Error("Vuelve a cargar el pedido antes de imprimirlo.");
          const res = await axiosAuth.get<ReceiptData>(
            saleReceiptUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", sale.id, currentSale),
          );
          if (res.data?.orderId !== sale.id) throw new Error("El comprobante no corresponde al pedido seleccionado.");
          return res.data;
        }),
      );

      // Imprimir usando la utilidad compartida (formato compacto con QR)
      if (!isCurrent()) { printWindow.close(); return; }
      await printReceipts(receipts, auth?.company, printWindow, isCurrent);
      if (!isCurrent()) return;

      toast.success(`${selectedSales.length} recibo(s) enviados a imprimir`);
      setSelectedIdsForActiveTab(new Set());
    } catch (error) {
      printWindow.close();
      if (!isCurrent()) return;
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
    } finally {
      printWindows.current.delete(printWindow);
      if (isPrintSessionCurrent()) setIsPrinting(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    if (!canMutateBulkSelection()) return;
    const selectedIds = Array.from(selectedSaleIds);
    if (selectedIds.length === 0) return;
    if (!canMutateIds(selectedIds)) return;

    if (newStatus === "ANULADO") {
      toast.error(
        "Para anular pedidos, use la opción individual con motivo de cancelación.",
      );
      return;
    }

    for (const id of selectedIds) {
      const sale = mutationSale(id);
      if (!sale) return;
      const blocked = salesStatusBlockReason(sale, newStatus);
      if (blocked) { toast.error(blocked); return; }
      if (await routeSaleLifecycle(sale, newStatus, () => toast.error("Reactiva las ventas con IMEI/series individualmente para seleccionar y confirmar sus unidades."))) return;
    }
    if (!canMutateBulkSelection() || !canMutateIds(selectedIds)) return;

    const selectedSales = selectedIds.map((id) => mutationSale(id)!);
    const blocked = selectedSales.map((sale) => salesStatusBlockReason(sale, newStatus) || assignmentBlockReason(sale, newStatus)).find(Boolean);
    if (blocked) { toast.error(blocked); return; }
    setIsBulkLoading(true);
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_VENTAS || "";

    try {
      const uInfo = getUserInfo();
      const result = await processBulkStatusChange(
        selectedIds,
        newStatus,
        apiBaseUrl,
        (processed, total) => {
          // Opcional: Podríamos mostrar un toast de progreso aquí si quisiéramos algo muy visual
        },
        10,
        uInfo.userId
          ? { userId: uInfo.userId, sellerName: uInfo.sellerName || "" }
          : undefined,
        undefined,
        undefined,
        new Set(selectedSales.filter(requiresAuthenticatedSaleMutation).map((sale) => sale.id)),
      );

      if (result.success.length > 0) {
        toast.success(
          `${result.success.length} pedido(s) actualizados a ${newStatus}`,
        );
      }

      if (result.failed.length > 0) {
        toast.error(
          `${result.failed.length} pedido(s) no pudieron actualizarse.`,
          {
            description: "Puede ser por reglas de transición de estado.",
            duration: 6000,
          },
        );
      }

      setSelectedIdsForActiveTab(new Set());
      refetchOrders();
    } catch (error) {
      toast.error("Error crítico durante la actualización masiva.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkReprogramar = async (callbackAtDate: Date) => {
    if (!canMutateBulkSelection()) return;
    const selectedIds = Array.from(selectedSaleIds);
    if (selectedIds.length === 0) return;
    if (!canMutateIds(selectedIds)) return;

    const callbackAt = callbackAtDate.toISOString();
    setIsBulkLoading(true);
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_VENTAS || "";
    try {
      const uInfo = getUserInfo();
      const result = await processBulkStatusChange(
        selectedIds,
        undefined,
        apiBaseUrl,
        undefined,
        10,
        uInfo.userId
          ? { userId: uInfo.userId, sellerName: uInfo.sellerName || "" }
          : undefined,
        "SCHEDULED",
        callbackAt,
        new Set(sales.filter(requiresAuthenticatedSaleMutation).map((sale) => sale.id)),
      );
      if (result.success.length > 0)
        toast.success(`${result.success.length} pedido(s) reprogramados`);
      if (result.failed.length > 0)
        toast.error(
          `${result.failed.length} pedido(s) no pudieron reprogramarse`,
        );
      setSelectedIdsForActiveTab(new Set());
      refetchOrders();
    } catch {
      toast.error("Error al reprogramar pedidos");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleIndividualReprogramar = async (
    saleId: string,
    callbackAt: Date,
  ) => {
    if (!mutationSale(saleId)) return;
    try {
      await axiosAuth.patch(
        saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", saleId, sales.find((sale) => sale.id === saleId)),
        {
          callStatus: "SCHEDULED",
          callbackAt: callbackAt.toISOString(),
          ...getUserInfo(),
        },
      );
      toast.success("Pedido reprogramado");
      refetchOrders();
    } catch {
      toast.error("Error al reprogramar el pedido");
    }
  };

  const bulkExtraActions: BulkExtraAction[] = canMutateIds(Array.from(selectedSaleIds)) ? [
    {
      value: BULK_ACTION_REPROGRAMAR,
      label: "Reprogramar",
      colorClassName: "text-violet-600",
    },
  ] : [];

  const handleBulkExtraAction = (actionValue: string) => {
    if (!canMutateBulkSelection() || !canMutateIds(Array.from(selectedSaleIds))) return;
    if (actionValue === BULK_ACTION_REPROGRAMAR) setBulkRescheduleOpen(true);
  };

  const handleBulkWhatsApp = (salesList: Sale[]) => {
    const selectedSales = salesList.filter((s) => selectedSaleIds.has(s.id));

    if (selectedSales.length === 0) {
      toast.warning("No hay pedidos seleccionados");
      return;
    }

    setSelectedIdsForActiveTab(new Set());
    toast.info(
      `Abriendo ${selectedSales.length} pestañas de WhatsApp... ¡Asegúrese de permitir Pop-ups!`,
    );

    selectedSales.forEach((sale, index) => {
      setTimeout(() => {
        handleWhatsApp(sale.phoneNumber, sale.orderNumber, sale.clientName);
      }, index * 600);
    });
  };

  const handleWhatsApp = (
    phoneNumber: string,
    orderNumber?: string,
    clientName?: string,
  ) => {
    const phone = phoneNumber.replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    let message = `Hola${clientName ? ` ${clientName}` : ""}! `;
    if (orderNumber) {
      const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}`;
      message += `Te contactamos por tu pedido ${orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;
    }

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  // Update tracking field locally
  const updateTrackingField = (
    orderId: string,
    field: keyof (typeof trackingEdits)[string],
    value: string,
  ) => {
    setTrackingEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  // Check if tracking data has changed for an order
  const hasTrackingChanges = (orderId: string): boolean => {
    const current = trackingEdits[orderId];
    const original = sales.find((s) => s.id === orderId);
    if (!current || !original) return false;

    return (
      current.externalTrackingNumber !== original.externalTrackingNumber ||
      current.shippingCode !== original.shippingCode ||
      current.shippingKey !== original.shippingKey ||
      current.shippingOffice !== original.shippingOffice
    );
  };

  // Save tracking fields for an order - only if changed
  const handleSaveTracking = async (orderId: string) => {
    if (!mutationSale(orderId)) return;
    if (!hasTrackingChanges(orderId)) return;

    const data = trackingEdits[orderId];
    if (!data) return;

    setSavingOrderId(orderId);
    try {
      await axiosAuth.patch(
        saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", orderId, sales.find((sale) => sale.id === orderId)),
        {
          externalTrackingNumber: data.externalTrackingNumber,
          shippingCode: data.shippingCode,
          shippingKey: data.shippingKey,
          shippingOffice: data.shippingOffice,
        },
      );
      toast.success("Información de tracking actualizada");

      // Update local sales state
      setSales((prev) =>
        prev.map((s) =>
          s.id === orderId
            ? {
                ...s,
                externalTrackingNumber: data.externalTrackingNumber,
                shippingCode: data.shippingCode,
                shippingKey: data.shippingKey,
                shippingOffice: data.shippingOffice,
              }
            : s,
        ),
      );
    } catch (error) {
      console.error("Error saving tracking data:", error);
      toast.error("Error al guardar información de tracking");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleEnviarLima = async (saleId: string) => {
    if (!mutationSale(saleId)) return;
    setSendingLimaId(saleId);
    try {
      await enviarPedidoALima(saleId);
      toast.success("Pedido enviado a CC Lima correctamente");
      refetchOrders();
    } catch {
      toast.error("No se pudo enviar el pedido a CC Lima");
    } finally {
      setSendingLimaId(null);
    }
  };

  const handleReassignSeller = async (sellerId: string, sellerName: string) => {
    if (!saleToReassign || !mutationSale(saleToReassign.id)) return;
    setIsReassigningLoading(true);
    try {
      await reassignSeller(
        saleToReassign.id,
        sellerId,
        sellerName,
        auth?.user?.id,
        auth?.user
          ? `${auth.user.name || ""} ${auth.user.surname || ""}`.trim()
          : undefined,
      );
      toast.success("Vendedor reasignado correctamente");
      setReassignSellerModalOpen(false);
      setSaleToReassign(null);
      refetchOrders();
    } catch {
      toast.error("No se pudo reasignar el vendedor");
    } finally {
      setIsReassigningLoading(false);
    }
  };

  // Tabla para Pendientes (sin delete)
  const PENDIENTES_COLSPAN = 13;

  const renderPendientesTable = (
    data: Sale[],
    showTracking: boolean = false,
    // status: carga o error de la consulta, como primera fila de la tabla
    extra: { status?: ReactNode; showDaysWithoutMovement?: boolean } = {},
  ) => (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
            {/* Columnas fijas izquierda */}
            <TableHead className="w-9 min-w-9 2xl:sticky 2xl:left-0 2xl:z-20 bg-muted" />
            <TableHead className="w-[45px] min-w-[45px] 2xl:sticky 2xl:left-9 2xl:z-20 bg-muted">
              <Checkbox
                disabled={!queryReady || data.length === 0}
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
                }
                onCheckedChange={(checked) => {
                  if (checked) {
                    if (!canMutateIds(data.map((sale) => sale.id))) return;
                    const next = new Set(selectedSaleIds);
                    data.forEach((s) => next.add(s.id));
                    setSelectedIdsForActiveTab(next);
                  } else {
                    const next = new Set(selectedSaleIds);
                    data.forEach((s) => next.delete(s.id));
                    setSelectedIdsForActiveTab(next);
                  }
                }}
              />
            </TableHead>
            <TableHead className="2xl:sticky 2xl:left-[81px] w-[100px] min-w-[100px] 2xl:z-20 bg-muted">
              N° Orden
            </TableHead>
            <TableHead className="2xl:sticky 2xl:left-[181px] w-[170px] min-w-[170px] 2xl:z-20 bg-muted border-r">
              Cliente
            </TableHead>
            <TableHead className="w-[130px] min-w-[130px]">
              Ciudad / Provincia
            </TableHead>
            {/* Columnas scrolleables */}
            <TableHead>Fecha</TableHead>
            <TableHead>Pago / Envío</TableHead>
            <TableHead className="text-right">Montos</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Origen</TableHead>
            {/* Columnas fijas derecha (Estado siempre visible para poder cambiarlo) */}
            <TableHead className="2xl:sticky 2xl:right-[240px] w-[68px] min-w-[68px] 2xl:w-[150px] 2xl:min-w-[150px] 2xl:z-20 bg-muted border-l">
              Estado
            </TableHead>
            <TableHead className="2xl:sticky 2xl:right-[140px] w-[100px] min-w-[100px] 2xl:z-20 bg-muted">
              Resumen
            </TableHead>
            <TableHead className="2xl:sticky 2xl:right-0 w-[140px] min-w-[140px] 2xl:z-20 bg-muted text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extra.status && (
            <TableRow>
              <TableCell colSpan={PENDIENTES_COLSPAN}>{extra.status}</TableCell>
            </TableRow>
          )}
          {data.map((sale) => {
            const isExpanded = expandedRows.has(sale.id);
            return (
              <Fragment key={sale.id}>
                <TableRow className="[&>td]:align-top [&>td]:py-3">
                  {/* Columnas fijas izquierda */}
                  <TableCell className="2xl:sticky 2xl:left-0 w-9 min-w-9 2xl:z-10 bg-background">
                    <button
                      type="button"
                      onClick={() => toggleRowExpand(sale.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title={
                        isExpanded ? "Ocultar detalles" : "Ver más detalles"
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:left-9 w-[45px] min-w-[45px] 2xl:z-10 bg-background">
                    <Checkbox
                      disabled={!queryReady}
                      checked={selectedSaleIds.has(sale.id)}
                      onCheckedChange={() => toggleSale(sale.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium 2xl:sticky 2xl:left-[81px] w-[100px] min-w-[100px] 2xl:z-10 bg-background text-xs">
                    <div className="flex items-center gap-1">
                      {hasUnitAssignment(sale) && <span className="text-xs text-amber-700">{unitAssignmentLabel(sale)}</span>}
                      {sale.hasStockIssue && (
                        <span title="Stock insuficiente - No se puede preparar">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </span>
                      )}
                      {sale.orderNumber}
                    </div>
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:left-[181px] w-[170px] min-w-[170px] 2xl:z-10 bg-background text-xs truncate max-w-[170px] border-r">
                    <div className="font-medium truncate">
                      {sale.clientName}
                    </div>
                    <div className="text-muted-foreground">
                      {sale.phoneNumber}
                    </div>
                  </TableCell>
                  <TableCell className="w-[130px] min-w-[130px] text-xs">
                    <div className="font-medium truncate">
                      {sale.city || "-"}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {sale.province || "-"}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Package className="h-3 w-3" />
                          {sale.items?.length || 0} items
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        <DropdownMenuLabel>Productos</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {sale.items && sale.items.length > 0 ? (
                          sale.items.map((item, idx) => (
                            <DropdownMenuItem
                              key={item.id || idx}
                              className="cursor-default gap-2"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <div className="h-7 w-7 flex-shrink-0 rounded bg-muted overflow-hidden">
                                {item.imageUrl ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    width={28}
                                    height={28}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">
                                    {item.productName.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <span className="truncate text-xs">
                                {item.productName} x{item.quantity}
                              </span>
                            </DropdownMenuItem>
                          ))
                        ) : (
                          <DropdownMenuItem disabled>
                            Sin items
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  {/* Columnas scrolleables */}
                  <TableCell className="text-xs">
                    {sale.date}
                    {extra.showDaysWithoutMovement && (
                      <div className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
                        {formatDaysWithoutMovement(daysWithoutMovement(sale.updatedAt, today))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{sale.paymentMethod}</div>
                    <div className="text-muted-foreground">
                      {sale.deliveryType}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    <div className="font-semibold">
                      {formatSalesMoney(sale.total, sale.currency)}
                    </div>
                    <div className="text-green-600">
                      Adel: {formatSalesMoney(sale.advancePayment, sale.currency)}
                    </div>
                    <div className="text-red-600">
                      Debe: {formatSalesMoney(sale.pendingPayment, sale.currency)}
                    </div>
                    <FinancialStatusBadge pendingAmount={sale.pendingPayment} />
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span>{sale.sellerName || "—"}</span>
                      <button
                        title="Reasignar vendedor"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          setSaleToReassign(sale);
                          setReassignSellerModalOpen(true);
                        }}
                      >
                        <UserPen className="h-3 w-3" />
                      </button>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <SourceBadge source={sale.externalSource} />
                      <ShopifyCancelledBadge cancelledAt={sale.shopifyCancelledAt} reason={sale.shopifyCancelReason} />
                    </span>
                  </TableCell>
                  {/* Columnas fijas derecha (Estado siempre visible para poder cambiarlo) */}
                  <TableCell className="2xl:sticky 2xl:right-[240px] w-[68px] min-w-[68px] 2xl:w-[150px] 2xl:min-w-[150px] 2xl:z-10 bg-background border-l">
                    <StatusSelect
                      status={sale.status}
                      options={getAvailableStatuses(
                        sale.status,
                        sale.salesRegion,
                      ).filter((status) => status === sale.status || (!salesStatusBlockReason(sale, status) && !assignmentBlockReason(sale, status)))}
                      extraAction={{
                        value: "__REPROGRAMAR__",
                        label: "Reprogramar",
                      }}
                      onStatusChange={(status) =>
                        handleChangeStatus(sale.id, status)
                      }
                      onExtraAction={() => { if (mutationSale(sale.id)) setRescheduleDialogSaleId(sale.id); }}
                    />
                    {salesPhysicalOperationBlockReason(sale) && <p className="mt-1 text-[10px] text-muted-foreground">{salesPhysicalOperationBlockReason(sale)}{sale.commercialLeadId && sale.commercialStockState === "DEFERRED" && <Link className="ml-1 font-semibold text-violet-700 underline" href={commercialLeadHref(sale.commercialLeadId)}>Preparar reserva de stock</Link>}</p>}
                    <ReprogramadoChip sale={sale} />
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:right-[140px] w-[100px] min-w-[100px] 2xl:z-10 bg-background">
                      <Button
                        type="button"
                        variant="outline"
                        className={orderDetailButtonClassName}
                        aria-label={`Ver detalle del pedido ${sale.orderNumber}`}
                        onClick={() => { if (visibleSale(sale.id)) { setDetailOrderScope(pageSessionScope); setDetailOrderId(sale.id); } }}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Ver
                      </Button>
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:right-0 w-[140px] min-w-[140px] 2xl:z-10 bg-background text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="outline"
                        className="relative bg-amber-50 hover:bg-amber-100 text-amber-600"
                        onClick={() => {
                          setSelectedSaleForPayment(sale);
                          setPaymentModalOpen(true);
                        }}
                        title={
                          sale.hasPendingApprovalPayments
                            ? "Pagos pendientes de aprobación"
                            : "Gestión de Pagos"
                        }
                      >
                        <DollarSign className="h-4 w-4" />
                        {sale.hasPendingApprovalPayments && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                        )}
                      </Button>
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
                      {sale.status === "PENDIENTE" && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-200"
                          title="Enviar a CC Lima"
                          disabled={sendingLimaId === sale.id}
                          onClick={() => handleEnviarLima(sale.id)}
                        >
                          {sendingLimaId === sale.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <SaleSecondaryDetails
                    key={`${sale.id}-details`}
                    sale={sale}
                    colSpan={PENDIENTES_COLSPAN}
                    showTracking={showTracking}
                    trackingEdits={trackingEdits}
                    savingOrderId={savingOrderId}
                    updateTrackingField={updateTrackingField}
                    handleSaveTracking={handleSaveTracking}
                  />
                )}
              </Fragment>
            );
          })}
          {data.length === 0 && !extra.status && (
            <TableRow>
              <TableCell
                colSpan={PENDIENTES_COLSPAN}
                className="text-center text-muted-foreground py-6"
              >
                No hay ventas en este estado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  // Tabla para Anulados (con delete)
  const ANULADOS_COLSPAN = 12;

  const renderAnuladosTable = (data: Sale[], showTracking: boolean = false, status?: ReactNode) => (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <Table className="min-w-[1050px]">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
            {/* Columnas fijas izquierda */}
            <TableHead className="w-9 min-w-9 2xl:sticky 2xl:left-0 2xl:z-20 bg-muted" />
            <TableHead className="w-[45px] min-w-[45px] 2xl:sticky 2xl:left-9 2xl:z-20 bg-muted">
              <Checkbox
                disabled={!queryReady || data.length === 0}
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
                }
                onCheckedChange={(checked) => {
                  if (checked) {
                    if (!canMutateIds(data.map((sale) => sale.id))) return;
                    const next = new Set(selectedSaleIds);
                    data.forEach((s) => next.add(s.id));
                    setSelectedIdsForActiveTab(next);
                  } else {
                    const next = new Set(selectedSaleIds);
                    data.forEach((s) => next.delete(s.id));
                    setSelectedIdsForActiveTab(next);
                  }
                }}
              />
            </TableHead>
            <TableHead className="2xl:sticky 2xl:left-[81px] w-[100px] min-w-[100px] 2xl:z-20 bg-muted">
              N° Orden
            </TableHead>
            <TableHead className="2xl:sticky 2xl:left-[181px] w-[170px] min-w-[170px] 2xl:z-20 bg-muted border-r">
              Cliente
            </TableHead>
            {/* Columnas scrolleables */}
            <TableHead>Fecha</TableHead>
            <TableHead>Pago / Envío</TableHead>
            <TableHead className="text-right">Montos</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Origen</TableHead>
            {/* Columnas fijas derecha (Estado siempre visible para poder cambiarlo) */}
            <TableHead className="2xl:sticky 2xl:right-[240px] w-[68px] min-w-[68px] 2xl:w-[150px] 2xl:min-w-[150px] 2xl:z-20 bg-muted border-l">
              Estado
            </TableHead>
            <TableHead className="2xl:sticky 2xl:right-[140px] w-[100px] min-w-[100px] 2xl:z-20 bg-muted">
              Resumen
            </TableHead>
            <TableHead className="2xl:sticky 2xl:right-0 w-[140px] min-w-[140px] 2xl:z-20 bg-muted text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {status && (
            <TableRow>
              <TableCell colSpan={ANULADOS_COLSPAN}>{status}</TableCell>
            </TableRow>
          )}
          {data.map((sale) => {
            const isExpanded = expandedRows.has(sale.id);
            return (
              <Fragment key={sale.id}>
                <TableRow className="[&>td]:align-top [&>td]:py-3">
                  {/* Columnas fijas izquierda */}
                  <TableCell className="2xl:sticky 2xl:left-0 w-9 min-w-9 2xl:z-10 bg-background">
                    <button
                      type="button"
                      onClick={() => toggleRowExpand(sale.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title={
                        isExpanded ? "Ocultar detalles" : "Ver más detalles"
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:left-9 w-[45px] min-w-[45px] 2xl:z-10 bg-background">
                    <Checkbox
                      disabled={!queryReady}
                      checked={selectedSaleIds.has(sale.id)}
                      onCheckedChange={() => toggleSale(sale.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium 2xl:sticky 2xl:left-[81px] w-[100px] min-w-[100px] 2xl:z-10 bg-background text-xs">
                    {sale.orderNumber}
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:left-[181px] w-[170px] min-w-[170px] 2xl:z-10 bg-background text-xs truncate max-w-[170px] border-r">
                    <div className="font-medium truncate">
                      {sale.clientName}
                    </div>
                    <div className="text-muted-foreground">
                      {sale.phoneNumber}
                    </div>
                  </TableCell>
                  {/* Columnas scrolleables */}
                  <TableCell className="text-xs">{sale.date}</TableCell>
                  <TableCell className="text-xs">
                    <div>{sale.paymentMethod}</div>
                    <div className="text-muted-foreground">
                      {sale.deliveryType}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    <div className="font-semibold">
                      {formatSalesMoney(sale.total, sale.currency)}
                    </div>
                    <div className="text-green-600">
                      Adel: {formatSalesMoney(sale.advancePayment, sale.currency)}
                    </div>
                    <div className="text-red-600">
                      Debe: {formatSalesMoney(sale.pendingPayment, sale.currency)}
                    </div>
                    <FinancialStatusBadge pendingAmount={sale.pendingPayment} />
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span>{sale.sellerName || "—"}</span>
                      <button
                        title="Reasignar vendedor"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {
                          setSaleToReassign(sale);
                          setReassignSellerModalOpen(true);
                        }}
                      >
                        <UserPen className="h-3 w-3" />
                      </button>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <SourceBadge source={sale.externalSource} />
                      <ShopifyCancelledBadge cancelledAt={sale.shopifyCancelledAt} reason={sale.shopifyCancelReason} />
                    </span>
                  </TableCell>
                  {/* Columnas fijas derecha (Estado siempre visible para poder cambiarlo) */}
                  <TableCell className="2xl:sticky 2xl:right-[240px] w-[68px] min-w-[68px] 2xl:w-[150px] 2xl:min-w-[150px] 2xl:z-10 bg-background border-l">
                    <StatusSelect
                      status={sale.status}
                      options={[sale.status]}
                      extraAction={{
                        value: "__RECUPERAR__",
                        label: "Recuperar venta",
                      }}
                      onStatusChange={() => {}}
                      onExtraAction={() =>
                        handleChangeStatus(sale.id, "PENDIENTE")
                      }
                    />
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:right-[140px] w-[100px] min-w-[100px] 2xl:z-10 bg-background">
                      <Button
                        type="button"
                        variant="outline"
                        className={orderDetailButtonClassName}
                        aria-label={`Ver detalle del pedido ${sale.orderNumber}`}
                        onClick={() => { if (visibleSale(sale.id)) { setDetailOrderScope(pageSessionScope); setDetailOrderId(sale.id); } }}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Ver
                      </Button>
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:right-0 w-[140px] min-w-[140px] 2xl:z-10 bg-background text-right">
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
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDelete(sale.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <SaleSecondaryDetails
                    key={`${sale.id}-details`}
                    sale={sale}
                    colSpan={ANULADOS_COLSPAN}
                    showTracking={showTracking}
                    trackingEdits={trackingEdits}
                    savingOrderId={savingOrderId}
                    updateTrackingField={updateTrackingField}
                    handleSaveTracking={handleSaveTracking}
                  />
                )}
              </Fragment>
            );
          })}
          {data.length === 0 && !status && (
            <TableRow>
              <TableCell
                colSpan={ANULADOS_COLSPAN}
                className="text-center text-muted-foreground py-6"
              >
                No hay ventas en este estado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  /* -----------------------------------------
     Filters
  ----------------------------------------- */

  // El servidor filtra todo el negocio antes de devolver esta página.
  const allPendientes = activeTab === "pendientes" ? sales : NO_SALES;
  const allAnulados = activeTab === "anuladas" ? sales : NO_SALES;
  const allTodas = activeTab === "todas" ? sales : NO_SALES;

  // Recientes y Antiguos comparten la selección de Pendientes: se vacía al cambiar
  const changePendientesView = (view: "recientes" | "antiguos") => {
    if (view === pendientesView) return;
    setPendientesView(view);
    setSelectedPendientesIds(new Set());
  };
  // Lo mismo al cambiar el período de Anuladas o Todas: se vacía la selección de esa pestaña
  const changeAnuladasWindow = (period: DateWindow) => {
    setAnuladasWindow(period);
    setSelectedAnuladosIds(new Set());
  };
  const changeTodasWindow = (period: DateWindow) => {
    setTodasWindow(period);
    setSelectedTodasIds(new Set());
  };

  const pendientes = allPendientes;
  const anulados = allAnulados;
  const todasLasVentas = allTodas;
  const productOptionsPendientes = salesPage?.metadata?.products ?? [];
  const productOptionsAnulados = productOptionsPendientes;
  const productOptionsAll = productOptionsPendientes;
  const kpis = {
    pendientes: salesPage?.kpis?.pendientes ?? 0,
    anuladas: salesPage?.kpis?.anuladas ?? 0,
    currencyBalances: salesPage?.kpis?.amounts ?? [],
  };
  const pendientesPage = pagePendientes;
  const anuladosPage = pageAnulados;
  const todasPage = pageAll;

  const selectedPendientesCount = pendientes.filter((s) =>
    selectedSaleIds.has(s.id),
  ).length;

  // Carga o error de la consulta de una pestaña: se ve en su tabla, sin tapar la página
  const renderQueryStatus = (
    // ready: false mientras la lista no cubre el período pedido (loader en vez de filas)
    state: { loading: boolean; error: boolean; retry: () => void; ready?: boolean },
    loadingLabel: string,
    errorText: string,
  ) =>
    state.loading || (state.ready === false && !state.error) ? (
      <PowipPulseLoader label={loadingLabel} />
    ) : state.error ? (
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
        {errorText}
        <Button variant="outline" size="sm" onClick={state.retry}>
          Reintentar
        </Button>
      </div>
    ) : null;

  // KPIs: "…" mientras cargan y "—" si fallan (con el aviso arriba). Nunca un 0 sin datos.
  const kpiText = (value: string | number) =>
    ventas.kpis.loading ? "…" : ventas.kpis.error ? "—" : value;

  // Número de Todas: el conteo del servidor mientras su lista no está lista; después, lo que muestra
  const todasTabCount = ventas.todas.count;

  if (!auth) return null;

  return (
      <div className="flex h-screen min-w-0 w-full bg-slate-100 dark:bg-background">
        <main className="min-w-0 flex-1 p-3 sm:p-6 space-y-6 overflow-auto">
          <HeaderConfig
            title="Ventas"
            description="Gestión de ventas pendientes y anuladas — todo en un solo panel."
          >
            <Button
              variant="outline"
              className="h-auto min-h-9 w-full max-w-full whitespace-normal text-center lg:w-auto"
              disabled={!importStore}
              onClick={() => { if (importStore) setImportModalOpen(true); }}
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              {importStore ? `Importar Excel a ${importStore.name}` : "Selecciona una tienda para importar"}
            </Button>
            <Link href="/registrar-venta" className="w-full lg:w-auto">
              <Button
                size="lg"
                className="w-full lg:w-auto bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 hover:from-violet-500 hover:to-purple-600 transition-shadow"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva venta
              </Button>
            </Link>
          </HeaderConfig>

          {/* KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-muted-foreground">
                Estadísticas
              </h2>
              <p className="text-xs text-muted-foreground/80">
                Corresponden a los pedidos pendientes por procesar.
              </p>
            </div>
            <PeriodSelector
              onPeriodChange={(from, to) => {
                setKpiDateFrom(from);
                setKpiDateTo(to);
              }}
            />
          </div>
          {!ventas.kpis.loading && ventas.kpis.error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              No se pudieron calcular las estadísticas.
              <Button variant="outline" size="sm" onClick={ventas.kpis.retry}>
                Reintentar
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pendientes</p>
                    <h3 className="mt-2 text-3xl font-bold tracking-tight">
                      {kpiText(kpis.pendientes)}
                    </h3>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Anuladas</p>
                    <h3 className="mt-2 text-3xl font-bold tracking-tight">
                      {kpiText(kpis.anuladas)}
                    </h3>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
                    <Ban className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Por cobrar</p>
                    <h3 className="mt-2 text-3xl font-bold tracking-tight">
                      {ventas.kpis.loading || ventas.kpis.error ? kpiText("") : kpis.currencyBalances.length ? kpis.currencyBalances.map((group) => <span key={group.currency ?? "UNKNOWN"} className="block">{formatSalesMoney(group.pending, group.currency)}</span>) : "0.00"}
                    </h3>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Adelantado</p>
                    <h3 className="mt-2 text-3xl font-bold tracking-tight">
                      {ventas.kpis.loading || ventas.kpis.error ? kpiText("") : kpis.currencyBalances.length ? kpis.currencyBalances.map((group) => <span key={group.currency ?? "UNKNOWN"} className="block">{formatSalesMoney(group.paid, group.currency)}</span>) : "0.00"}
                    </h3>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs para Ventas */}
          <Tabs
            value={activeTab}
            className="min-w-0 w-full"
            onValueChange={setActiveTab}
          >
            <TabsList className="mb-4 h-auto max-w-full flex-wrap justify-start">
              <TabsTrigger value="pendientes">
                Ventas Pendientes
                <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold">
                  {salesPage?.counts?.pendientes ?? "—"}
                </span>
              </TabsTrigger>
              <TabsTrigger value="anuladas">
                Ventas Anuladas
                {ventas.anuladas.ready && (
                <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold">
                  {salesPage?.counts?.anuladas ?? "—"}
                </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="todas">
                Todas las Ventas
                {todasTabCount !== null && (
                <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold">
                  {todasTabCount}
                </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab Pendientes */}
            <TabsContent value="pendientes">
              <Card>
                <CardHeader className="flex min-w-0 flex-col gap-4">
                  <div>
                    <CardTitle>Ventas Pendientes</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Los pedidos en Atención también se consultan en Todas las Ventas.</p>
                  </div>
                  <div className="flex min-w-0 w-full flex-wrap items-center gap-2 [&>button]:h-auto [&>button]:min-h-9 [&>button]:whitespace-normal">
                    <BulkStatusSelect
                      disabled={!queryReady}
                      selectedCount={selectedSaleIds.size}
                      availableStatuses={bulkAvailableStatuses}
                      onStatusChange={handleBulkStatusChange}
                      isLoading={isBulkLoading}
                      extraActions={bulkExtraActions}
                      onExtraAction={handleBulkExtraAction}
                    />
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={selectedPendientesCount === 0 || isPrinting}
                      onClick={handleBulkPrint}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      {isPrinting
                        ? "Procesando..."
                        : `Imprimir seleccionados (${selectedPendientesCount})`}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-green-600 border-green-200 hover:bg-green-50"
                      disabled={selectedPendientesCount === 0}
                      onClick={() => handleBulkWhatsApp(pendientes)}
                    >
                      <WhatsAppIcon className="h-4 w-4 mr-2" />
                      WhatsApp Masivo ({selectedPendientesCount})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={selectedPendientesCount === 0}
                      onClick={() => handleCopySelected(pendientes)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar seleccionados ({selectedPendientesCount})
                    </Button>
                    {canExport && (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={!queryReady || isExporting}
                        onClick={() =>
                          handleExportExcel(
                            pendientes,
                            "pendientes",
                            filtersPendiente.product,
                          )
                        }
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant={pendientesView === "recientes" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      aria-pressed={pendientesView === "recientes"}
                      onClick={() => changePendientesView("recientes")}
                    >
                      Recientes
                    </Button>
                    <Button
                      variant={pendientesView === "antiguos" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      aria-pressed={pendientesView === "antiguos"}
                      disabled={ventas.antiguos.count === 0}
                      onClick={() => changePendientesView("antiguos")}
                    >
                      {ventas.antiguos.count
                        ? `Pendientes antiguos (${ventas.antiguos.count})`
                        : "Pendientes antiguos"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Los pendientes de más de 30 días están en Pendientes antiguos
                    </span>
                  </div>
                  <SalesTableFilters
                    filters={filtersPendiente}
                    onFiltersChange={setFiltersPendiente}
                    showProductFilter
                    availableProducts={productOptionsPendientes}
                  />
                  {renderPendientesTable(pendientes, activeTab === "todas", {
                    showDaysWithoutMovement: pendientesView === "antiguos",
                    status: renderQueryStatus(queryState, pendientesView === "antiguos" ? "Cargando pendientes antiguos..." : "Cargando ventas...", pendientesView === "antiguos" ? "No se pudieron cargar los pendientes antiguos." : "No se pudieron cargar las ventas del alcance seleccionado."),
                  })}
                </CardContent>
                <Pagination
                  currentPage={pendientesPage}
                  totalPages={salesPage?.totalPages ?? 1}
                  totalItems={salesPage?.total ?? 0}
                  itemsPerPage={10}
                  onPageChange={setPagePendientes}
                  itemName="ventas"
                />
              </Card>
            </TabsContent>

            {/* Tab Anuladas */}
            <TabsContent value="anuladas">
              <Card>
                <CardHeader className="flex min-w-0 flex-col gap-4">
                  <CardTitle>Ventas Anuladas</CardTitle>
                  <div className="flex min-w-0 w-full flex-wrap items-center gap-2 [&>button]:h-auto [&>button]:min-h-9 [&>button]:whitespace-normal">
                    <BulkStatusSelect
                      disabled={!ventas.anuladas.ready}
                      selectedCount={selectedSaleIds.size}
                      availableStatuses={bulkAvailableStatuses}
                      onStatusChange={handleBulkStatusChange}
                      isLoading={isBulkLoading}
                      extraActions={bulkExtraActions}
                      onExtraAction={handleBulkExtraAction}
                    />
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={
                        anulados.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0 || isPrinting
                      }
                      onClick={() =>
                        handleBulkPrintForStatus(anulados, "ANULADO")
                      }
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir seleccionados (
                      {anulados.filter((s) => selectedSaleIds.has(s.id)).length})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-green-600 border-green-200 hover:bg-green-50"
                      disabled={
                        anulados.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleBulkWhatsApp(anulados)}
                    >
                      <WhatsAppIcon className="h-4 w-4 mr-2" />
                      WhatsApp Masivo (
                      {anulados.filter((s) => selectedSaleIds.has(s.id)).length})
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={
                        anulados.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleCopySelected(anulados)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar seleccionados (
                      {anulados.filter((s) => selectedSaleIds.has(s.id)).length})
                    </Button>
                    {canExport && (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={!queryReady || isExporting}
                        onClick={() =>
                          handleExportExcel(
                            anulados,
                            "anuladas",
                            filtersAnulado.product,
                          )
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
                    filters={filtersAnulado}
                    onFiltersChange={setFiltersAnulado}
                    showProductFilter
                    availableProducts={productOptionsAnulados}
                    dateWindow={{ value: anuladasWindow, today, defaultFromDate: ventasRecentFrom(today), onChange: changeAnuladasWindow }}
                  />
                  {renderAnuladosTable(anulados, activeTab === "todas", renderQueryStatus(ventas.anuladas, "Cargando ventas...", "No se pudieron cargar las ventas de este período."))}
                </CardContent>
                <Pagination
                  currentPage={anuladosPage}
                  totalPages={salesPage?.totalPages ?? 1}
                  totalItems={salesPage?.total ?? 0}
                  itemsPerPage={10}
                  onPageChange={setPageAnulados}
                  itemName="ventas"
                />
              </Card>
            </TabsContent>

            {/* Tab Todas las Ventas */}
            <TabsContent value="todas">
              <Card>
                <CardHeader className="flex min-w-0 flex-col gap-4">
                  <div>
                    <CardTitle>Todas las Ventas</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Incluye los pedidos que están en Atención al cliente.</p>
                  </div>
                  <div className="flex min-w-0 w-full flex-wrap items-center gap-2 [&>button]:h-auto [&>button]:min-h-9 [&>button]:whitespace-normal">
                    <BulkStatusSelect
                      disabled={!ventas.todas.ready}
                      selectedCount={selectedSaleIds.size}
                      availableStatuses={bulkAvailableStatuses}
                      onStatusChange={handleBulkStatusChange}
                      isLoading={isBulkLoading}
                      extraActions={bulkExtraActions}
                      onExtraAction={handleBulkExtraAction}
                    />
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={
                        todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0 || isPrinting
                      }
                      onClick={() =>
                        handleBulkPrintForStatus(todasLasVentas, "TODAS")
                      }
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir seleccionados (
                      {
                        todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                          .length
                      }
                      )
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-green-600 border-green-200 hover:bg-green-50"
                      disabled={
                        todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleBulkWhatsApp(todasLasVentas)}
                    >
                      <WhatsAppIcon className="h-4 w-4 mr-2" />
                      WhatsApp Masivo (
                      {
                        todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                          .length
                      }
                      )
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={
                        todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                          .length === 0
                      }
                      onClick={() => handleCopySelected(todasLasVentas)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar seleccionados (
                      {
                        todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                          .length
                      }
                      )
                    </Button>
                    {canExport && (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={!queryReady || isExporting}
                        onClick={() =>
                          handleExportExcel(
                            todasLasVentas,
                            "todas_las_ventas",
                            filtersAll.product,
                          )
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
                    filters={filtersAll}
                    onFiltersChange={(newFilters) => {
                      setFiltersAll(newFilters);
                      setPageAll(1); // Reset page when filters change
                    }}
                    showProductFilter
                    availableProducts={productOptionsAll}
                    dateWindow={{ value: todasWindow, today, defaultFromDate: ventasRecentFrom(today), onChange: changeTodasWindow }}
                  />
                  {renderPendientesTable(
                    todasLasVentas,
                    activeTab === "todas",
                    { status: renderQueryStatus({ loading: todasLoading, error: todasError, retry: ventas.todas.retry, ready: ventas.todas.ready }, "Cargando ventas...", "No se pudieron cargar las ventas de este período.") },
                  )}
                </CardContent>
                <Pagination
                  currentPage={todasPage}
                  totalPages={salesPage?.totalPages ?? 1}
                  totalItems={salesPage?.total ?? 0}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={setPageAll}
                  itemName="ventas"
                />
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {detailOrderId && detailOrderIsVisible && (
          <Suspense fallback={null}>
            <SalesOrderDetailModal
              open
              orderId={detailOrderId}
              onClose={() => setDetailOrderId(null)}
              onOrderUpdated={refetchOrders}
              showTracking
              onOpenCreateGuide={(order) => { if (mutationSale(order.id)) setCreateGuideOrder(order); }}
            />
          </Suspense>
        )}

        {createGuideOrder && mutationSale(createGuideOrder.id) && (
          <CreateGuideModal
            open={!!createGuideOrder}
            onClose={() => setCreateGuideOrder(null)}
            storeId={createGuideOrder.storeId}
            isLoading={isCreatingGuide}
            selectedOrders={[
              {
                id: createGuideOrder.id,
                storeId: createGuideOrder.storeId,
                inventoryId: createGuideOrder.inventoryId,
                stockStoreId: createGuideOrder.stockStoreId,
                orderNumber: createGuideOrder.orderNumber,
                clientName: createGuideOrder.customer.fullName,
                address: createGuideOrder.customer.address,
                district: createGuideOrder.customer.district,
                total: Number(createGuideOrder.grandTotal),
                pendingPayment: orderFinancialState(createGuideOrder).pendingAmount,
                zone: createGuideOrder.customer.zone,
              },
            ]}
            onConfirm={handleCreateGuide}
          />
        )}

        <CancellationModal
          open={cancellationModalOpen && !!saleToCancel && !!mutationSale(saleToCancel.id)}
          onClose={() => {
            setCancellationModalOpen(false);
            setSaleToCancel(null);
          }}
          orderNumber={saleToCancel?.orderNumber || ""}
          onConfirm={handleConfirmCancellation}
          isLoading={isCancelling}
        />

        <CommentsTimelineModal
          open={commentsModalOpen && !!selectedSaleForComments && !!mutationSale(selectedSaleForComments.id)}
          onClose={() => {
            setCommentsModalOpen(false);
            setSelectedSaleForComments(null);
          }}
          orderId={selectedSaleForComments?.id || ""}
          orderNumber={selectedSaleForComments?.orderNumber || ""}
        />

        <PaymentVerificationModal
          open={paymentModalOpen && !!selectedSaleForPayment && !!mutationSale(selectedSaleForPayment.id)}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedSaleForPayment(null);
          }}
          orderId={selectedSaleForPayment?.id || ""}
          orderNumber={selectedSaleForPayment?.orderNumber || ""}
          onPaymentUpdated={refetchOrders}
        />

        {lifecycle && mutationSale(lifecycle.orderId) && <SaleUnitLifecycleModal open {...lifecycle} onClose={() => setLifecycle(null)} onUpdated={refetchOrders} />}
        <BulkPrintPreviewDialog
          key={printScope}
          scopeKey={printScope}
          open={printPreviewOpen && pendingPrintScope === printScope && canMutateIds(pendingPrintSales.map((sale) => sale.id))}
          orders={pendingPrintSales}
          company={auth?.company}
          fetchReceipt={fetchPrintReceipt}
          onConfirm={handleConfirmPrint}
          onClose={handleClosePrintPreview}
        />
        {/* Modal de alerta de stock insuficiente */}
        <AlertDialog open={stockAlertOpen} onOpenChange={setStockAlertOpen}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertDialogTitle>Atención: Stock Insuficiente</AlertDialogTitle>
              </div>
              <AlertDialogDescription asChild>
                <div className="space-y-4 text-sm">
                  <p className="text-muted-foreground">
                    Se han actualizado los estados a <strong>PREPARADO</strong>,
                    pero se ha detectado que los siguientes pedidos tienen
                    productos con <strong>stock insuficiente o nulo</strong>:
                  </p>
                  <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
                    <ul className="space-y-3">
                      {ordersWithStockIssue.map((sale) => (
                        <li
                          key={sale.id}
                          className="border-b border-border/50 pb-2 last:border-0 last:pb-0"
                        >
                          <div className="font-bold text-foreground mb-1">
                            Pedido: {sale.orderNumber}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-col gap-1">
                            <span className="flex items-center gap-1">
                              <strong>Cliente:</strong> {sale.clientName}
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {sale.items.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="bg-background px-2 py-0.5 rounded border border-border text-[10px]"
                                >
                                  {item.productName} (x{item.quantity})
                                </span>
                              ))}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 italic">
                    Por favor, revise el inventario físico antes de proceder con
                    el despacho de estos pedidos.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-amber-600 hover:bg-amber-700">
                Entendido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {importStore && <ImportSalesModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onSuccess={() => {
            refetchOrders();
            setImportModalOpen(false);
          }}
          storeId={importStore.id}
          userId={auth.user?.id}
          sellerName={
            auth.user
              ? `${auth.user.name || ""} ${auth.user.surname || ""}`.trim()
              : undefined
          }
        />}

        <RescheduleDialog
          open={rescheduleDialogSaleId !== null && !!mutationSale(rescheduleDialogSaleId)}
          onOpenChange={(open) => {
            if (!open) setRescheduleDialogSaleId(null);
          }}
          onConfirm={(date) => {
            if (rescheduleDialogSaleId) {
              handleIndividualReprogramar(rescheduleDialogSaleId, date);
              setRescheduleDialogSaleId(null);
            }
          }}
        />

        <RescheduleDialog
          open={bulkRescheduleOpen}
          onOpenChange={setBulkRescheduleOpen}
          onConfirm={(date) => {
            handleBulkReprogramar(date);
            setBulkRescheduleOpen(false);
          }}
        />

        {saleToReassign && (
          <ReassignSellerModal
            open={reassignSellerModalOpen && !!mutationSale(saleToReassign.id)}
            onClose={() => {
              setReassignSellerModalOpen(false);
              setSaleToReassign(null);
            }}
            orderNumber={saleToReassign.orderNumber}
            currentSellerName={saleToReassign.sellerName}
            companyId={auth?.company?.id ?? ""}
            onConfirm={handleReassignSeller}
            isLoading={isReassigningLoading}
          />
        )}
      </div>
  );
}

export default function VentasPage() {
  const { scopeKey } = useBusinessScope();
  return <VentasContent key={scopeKey} />;
}
