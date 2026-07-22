"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  ArrowRight,
  Printer,
  AlertTriangle,
  Download,
  MessageCircle,
  Loader2,
  UploadCloud,
  MapPin,
  Clock,
  Ban,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SourceBadge } from "@/components/shared/SourceBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Label } from "@/components/ui/label";

import { OrderHeader, OrderStatus, OrderItem } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import CustomerServiceModal, {
  ShippingGuideData,
} from "@/components/modals/CustomerServiceModal";
import ImportSalesModal from "@/components/modals/ImportSalesModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import {
  SalesTableFilters,
  SalesFilters,
  emptySalesFilters,
  applyFilters,
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
import { printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";
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
import { exportSalesToExcel, SaleExportData } from "@/utils/exportSalesExcel";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import type { BulkExtraAction } from "@/components/ventas/BulkStatusSelect";
import { processBulkStatusChange } from "@/utils/bulkStatusUtils";
import { RescheduleDialog } from "@/components/ventas/RescheduleDialog";
import { useOrdersByStore } from "@/hooks/useOrdersByStore";
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

export interface Sale {
  id: string;
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
  externalId?: string | null;
  aliclikDispatchStatus?: string | null;
  aliclikSyncedAt?: string | null;
}

/* -----------------------------------------
   Mapper
----------------------------------------- */

function mapOrderToSale(order: OrderHeader): Sale {
  const total = Number(order.grandTotal);
  const advancePayment = order.payments
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const pendingPayment = Math.max(total - advancePayment, 0);
  const hasPendingApprovalPayments = order.payments.some(
    (p) => p.status === "PENDING",
  );

  return {
    id: order.id,
    customerId: order.customer.id,
    orderNumber: order.orderNumber,
    clientName: order.customer.fullName,
    phoneNumber: order.customer.phoneNumber ?? "999",
    documentType: order.customer.documentType ?? null,
    documentNumber: order.customer.documentNumber ?? null,
    date: new Date(order.created_at).toLocaleDateString("es-AR"),
    total,
    status: order.status,
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
    salesRegion: order.salesRegion,
    district: order.customer.district ?? "",
    city: order.customer.city ?? "",
    province: order.customer.province ?? "",
    zone: order.customer.zone ?? "",
    address: order.customer.address ?? "",
    advancePayment,
    pendingPayment,
    hasStockIssue: order.hasStockIssue ?? false,
    hasPendingApprovalPayments,
    externalTrackingNumber: order.externalTrackingNumber || "",
    shippingCode: order.shippingCode || "",
    shippingKey: order.shippingKey || "",
    shippingOffice: order.shippingOffice || "",
    sellerName: order.sellerName ?? null,
    items: order.items || [],
    externalSource: order.externalSource ?? null,
    externalId: order.externalId ?? null,
    aliclikDispatchStatus: order.aliclikDispatchStatus ?? null,
    aliclikSyncedAt: order.aliclikSyncedAt ?? null,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedShippingGuide, setSelectedShippingGuide] =
    useState<ShippingGuideData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Filtros avanzados
  const [filtersPendiente, setFiltersPendiente] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersAnulado, setFiltersAnulado] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersAll, setFiltersAll] = useState<SalesFilters>(emptySalesFilters);

  // Paginación para Todas las Ventas
  const [pageAll, setPageAll] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  // Estado para modal de confirmación de impresión
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [pendingPrintSales, setPendingPrintSales] = useState<Sale[]>([]);

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

  const [reassignSellerModalOpen, setReassignSellerModalOpen] = useState(false);
  const [saleToReassign, setSaleToReassign] = useState<Sale | null>(null);
  const [isReassigningLoading, setIsReassigningLoading] = useState(false);

  const BULK_ACTION_REPROGRAMAR = "__REPROGRAMAR__";

  const { auth, selectedStoreId } = useAuth();
  const router = useRouter();

  const { data: ordersData, refetch: refetchOrders } =
    useOrdersByStore(selectedStoreId);

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
        (s: OrderStatus) => s !== "ANULADO",
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
    if (!ordersData) return;

    const sorted = [...ordersData].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const mappedSales = sorted.map(mapOrderToSale);
    setSales(mappedSales);

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
  }, [ordersData]);

  // Helper: info del usuario actual para trazabilidad
  const getUserInfo = () => ({
    userId: auth?.user?.id,
    sellerName:
      [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ") ||
      undefined,
  });

  const handleChangeStatus = async (
    saleId: string,
    newStatus: OrderStatus,
    cancellationReason?: CancellationReason,
  ) => {
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

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleId}`,
        payload,
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      refetchOrders();
    } catch (error) {
      console.error("Error actualizando estado", error);
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleConfirmCancellation = async (
    reason: CancellationReason,
    notes?: string,
  ) => {
    if (!saleToCancel) return;

    setIsCancelling(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleToCancel.id}`,
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
    const next = new Set(selectedSaleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIdsForActiveTab(next);
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(
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
      .map((sale) =>
        `
Venta ${sale.orderNumber}
Cliente: ${sale.clientName}
Teléfono: ${sale.phoneNumber}
Distrito: ${sale.district}
Dirección: ${sale.address}
Fecha: ${sale.date}
Total Venta: $${sale.total.toFixed(2)}
Adelanto: $${sale.advancePayment.toFixed(2)}
Por Cobrar: $${sale.pendingPayment.toFixed(2)}
Estado: ${sale.status}
`.trim(),
      )
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
      orderNumber: s.orderNumber,
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
      paymentMethod: s.paymentMethod,
      deliveryType: s.deliveryType,
    }));

    exportSalesToExcel(exportData, `ventas_${tabName}`);
    toast.success(`Exportados ${salesList.length} registros`);
  };

  // Impresión masiva: obtiene recibos, imprime cada uno en página separada, luego cambia estado
  const handleBulkPrint = async () => {
    const selectedPendientes = pendientes.filter((s) =>
      selectedSaleIds.has(s.id),
    );

    if (selectedPendientes.length === 0) {
      toast.warning("No hay pedidos seleccionados para imprimir");
      return;
    }

    setIsPrinting(true);
    toast.info(
      `Preparando ${selectedPendientes.length} recibo(s) para imprimir...`,
    );

    try {
      // Obtener recibos de todas las ventas seleccionadas
      const receipts = await Promise.all(
        selectedPendientes.map(async (sale) => {
          const res = await axios.get<ReceiptData>(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}/receipt`,
          );
          return res.data;
        }),
      );

      // Imprimir usando la utilidad compartida (formato compacto con QR)
      await printReceipts(receipts);

      // Guardar ventas pendientes y mostrar modal de confirmación
      setPendingPrintSales(selectedPendientes);
      setPrintConfirmOpen(true);
      setIsPrinting(false);
    } catch (error) {
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
      setIsPrinting(false);
    }
  };

  // Confirmar impresión y cambiar estados
  const handleConfirmPrint = async () => {
    if (pendingPrintSales.length === 0) return;

    setIsPrinting(true);
    let successCount = 0;
    let errorCount = 0;

    // Identificar órdenes con problemas de stock para informar al usuario al final
    const issues = pendingPrintSales.filter((s) => s.hasStockIssue);
    setOrdersWithStockIssue(issues);

    for (const sale of pendingPrintSales) {
      const newStatus = "PREPARADO";
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}`,
          { status: newStatus, ...getUserInfo() },
        );
        successCount++;
      } catch (error) {
        console.error(`Error actualizando ${sale.orderNumber}`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} pedido(s) actualizados a PREPARADO`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} pedido(s) no pudieron ser actualizados`);
    }

    refetchOrders();
    setSelectedIdsForActiveTab(new Set());
    setPendingPrintSales([]);
    setPrintConfirmOpen(false);
    setIsPrinting(false);

    // Si hubo órdenes con problemas de stock, mostrar el modal de alerta
    if (issues.length > 0) {
      setStockAlertOpen(true);
    }
  };

  // Cancelar confirmación de impresión
  const handleCancelPrint = () => {
    toast.info("Impresión cancelada. Los estados no fueron modificados.");
    setPendingPrintSales([]);
    setPrintConfirmOpen(false);
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

    setIsPrinting(true);
    toast.info(`Preparando ${selectedSales.length} recibo(s) para imprimir...`);

    try {
      const receipts = await Promise.all(
        selectedSales.map(async (sale) => {
          const res = await axios.get<ReceiptData>(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}/receipt`,
          );
          return res.data;
        }),
      );

      // Imprimir usando la utilidad compartida (formato compacto con QR)
      await printReceipts(receipts);

      toast.success(`${selectedSales.length} recibo(s) enviados a imprimir`);
      setSelectedIdsForActiveTab(new Set());
    } catch (error) {
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    const selectedIds = Array.from(selectedSaleIds);
    if (selectedIds.length === 0) return;

    if (newStatus === "ANULADO") {
      toast.error(
        "Para anular pedidos, use la opción individual con motivo de cancelación.",
      );
      return;
    }

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

  const handleBulkReprogramar = async () => {
    const selectedIds = Array.from(selectedSaleIds);
    if (selectedIds.length === 0) return;

    const callbackAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleId}`,
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

  const bulkExtraActions: BulkExtraAction[] = [
    {
      value: BULK_ACTION_REPROGRAMAR,
      label: "Reprogramar",
      colorClassName: "text-violet-600",
    },
  ];

  const handleBulkExtraAction = (actionValue: string) => {
    if (actionValue === BULK_ACTION_REPROGRAMAR) handleBulkReprogramar();
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
    if (!hasTrackingChanges(orderId)) return;

    const data = trackingEdits[orderId];
    if (!data) return;

    setSavingOrderId(orderId);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
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

  // Abrir modal de recibo, cargando datos de guía si es EN_ENVIO
  const handleOpenReceipt = async (sale: Sale) => {
    setSelectedOrderId(sale.id);

    // Si es EN_ENVIO, cargar datos de la guía (no tenemos guideNumber en Sale interface de ventas)
    if (sale.status === "EN_ENVIO") {
      try {
        const guideRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${sale.id}`,
        );
        const guide = guideRes.data;

        if (guide) {
          // Calcular días desde creación
          let daysSinceCreated = 0;
          if (guide?.created_at) {
            const createdDate = new Date(guide.created_at);
            const today = new Date();
            const diffTime = Math.abs(today.getTime() - createdDate.getTime());
            daysSinceCreated = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          setSelectedShippingGuide({
            id: guide.id,
            guideNumber: guide.guideNumber,
            courierName: guide.courierName,
            status: guide.status,
            chargeType: guide.chargeType,
            amountToCollect: guide.amountToCollect,
            scheduledDate: guide.scheduledDate?.toString() || null,
            deliveryZone: guide.deliveryZone,
            deliveryType: guide.deliveryType,
            deliveryAddress: guide.deliveryAddress,
            notes: guide.notes,
            trackingUrl: guide.trackingUrl,
            shippingKey: guide.shippingKey,
            shippingOffice: guide.shippingOffice,
            shippingProofUrl: guide.shippingProofUrl,
            created_at: guide.created_at,
            daysSinceCreated,
          });
        } else {
          setSelectedShippingGuide(null);
        }
      } catch (error) {
        console.error("Error fetching shipping guide:", error);
        setSelectedShippingGuide(null);
      }
    } else {
      setSelectedShippingGuide(null);
    }

    setReceiptOpen(true);
  };

  const handleEnviarLima = async (saleId: string) => {
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
    if (!saleToReassign) return;
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
  ) => (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
            {/* Columnas fijas izquierda */}
            <TableHead className="w-9 min-w-9 2xl:sticky 2xl:left-0 2xl:z-20 bg-muted" />
            <TableHead className="w-[45px] min-w-[45px] 2xl:sticky 2xl:left-9 2xl:z-20 bg-muted">
              <Checkbox
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
                }
                onCheckedChange={(checked) => {
                  if (checked) {
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
            <TableHead className="w-[100px] min-w-[100px]">Items</TableHead>
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
                      checked={selectedSaleIds.has(sale.id)}
                      onCheckedChange={() => toggleSale(sale.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium 2xl:sticky 2xl:left-[81px] w-[100px] min-w-[100px] 2xl:z-10 bg-background text-xs">
                    <div className="flex items-center gap-1">
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
                  <TableCell>
                    <div className="flex -space-x-2 overflow-hidden">
                      {sale.items?.slice(0, 3).map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-muted overflow-hidden"
                          title={item.productName}
                        >
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.productName}
                              width={32}
                              height={32}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">
                              {item.productName.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                      {sale.items?.length > 3 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted ring-2 ring-background text-[10px] font-medium">
                          +{sale.items.length - 3}
                        </div>
                      )}
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
                      ${sale.total.toFixed(2)}
                    </div>
                    <div className="text-green-600">
                      Adel: ${sale.advancePayment.toFixed(2)}
                    </div>
                    <div className="text-red-600">
                      Debe: ${sale.pendingPayment.toFixed(2)}
                    </div>
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
                    <SourceBadge source={sale.externalSource} />
                  </TableCell>
                  {/* Columnas fijas derecha (Estado siempre visible para poder cambiarlo) */}
                  <TableCell className="2xl:sticky 2xl:right-[240px] w-[68px] min-w-[68px] 2xl:w-[150px] 2xl:min-w-[150px] 2xl:z-10 bg-background border-l">
                    <StatusSelect
                      status={sale.status}
                      options={getAvailableStatuses(
                        sale.status,
                        sale.salesRegion,
                      )}
                      extraAction={{
                        value: "__REPROGRAMAR__",
                        label: "Reprogramar",
                      }}
                      onStatusChange={(status) =>
                        handleChangeStatus(sale.id, status)
                      }
                      onExtraAction={() => setRescheduleDialogSaleId(sale.id)}
                    />
                  </TableCell>
                  <TableCell className="2xl:sticky 2xl:right-[140px] w-[100px] min-w-[100px] 2xl:z-10 bg-background">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenReceipt(sale)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
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
                        <MessageCircle className="h-4 w-4" />
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
          {data.length === 0 && (
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

  const renderAnuladosTable = (data: Sale[], showTracking: boolean = false) => (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <Table className="min-w-[1050px]">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
            {/* Columnas fijas izquierda */}
            <TableHead className="w-9 min-w-9 2xl:sticky 2xl:left-0 2xl:z-20 bg-muted" />
            <TableHead className="w-[45px] min-w-[45px] 2xl:sticky 2xl:left-9 2xl:z-20 bg-muted">
              <Checkbox
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
                }
                onCheckedChange={(checked) => {
                  if (checked) {
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
                      ${sale.total.toFixed(2)}
                    </div>
                    <div className="text-green-600">
                      Adel: ${sale.advancePayment.toFixed(2)}
                    </div>
                    <div className="text-red-600">
                      Debe: ${sale.pendingPayment.toFixed(2)}
                    </div>
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
                    <SourceBadge source={sale.externalSource} />
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
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenReceipt(sale)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
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
                        <MessageCircle className="h-4 w-4" />
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
          {data.length === 0 && (
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

  const pendientes = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.status === ORDER_STATUS.PENDIENTE,
    );
    return applyFilters(statusFiltered, filtersPendiente);
  }, [sales, filtersPendiente]);

  const anulados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.status === ORDER_STATUS.ANULADO,
    );
    return applyFilters(statusFiltered, filtersAnulado);
  }, [sales, filtersAnulado]);

  const todasLasVentas = useMemo(
    () => applyFilters(sales, filtersAll),
    [sales, filtersAll],
  );

  const kpis = useMemo(() => {
    const porCobrar = pendientes.reduce((acc, s) => acc + s.pendingPayment, 0);
    const adelantado = pendientes.reduce((acc, s) => acc + s.advancePayment, 0);
    return {
      pendientes: pendientes.length,
      anuladas: anulados.length,
      porCobrar,
      adelantado,
    };
  }, [pendientes, anulados]);

  const selectedPendientesCount = pendientes.filter((s) =>
    selectedSaleIds.has(s.id),
  ).length;

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-background">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <HeaderConfig
          title="Ventas"
          description="Gestión de ventas pendientes y anuladas — todo en un solo panel."
        >
          <Button
            variant="outline"
            className="w-full lg:w-auto"
            onClick={() => setImportModalOpen(true)}
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Importar Excel
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
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
          <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-muted">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <h3 className="mt-2 text-3xl font-bold tracking-tight">
                    {kpis.pendientes}
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
                    {kpis.anuladas}
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
                    ${kpis.porCobrar.toFixed(2)}
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
                    ${kpis.adelantado.toFixed(2)}
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
          defaultValue="pendientes"
          className="w-full"
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="pendientes">
              Ventas Pendientes
              <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold">
                {pendientes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="anuladas">
              Ventas Anuladas
              <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold">
                {anulados.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="todas">
              Todas las Ventas
              <span className="ml-1.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 px-1.5 py-0.5 text-[10px] font-bold">
                {todasLasVentas.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Pendientes */}
          <TabsContent value="pendientes">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle>Ventas Pendientes</CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                    extraActions={bulkExtraActions}
                    onExtraAction={handleBulkExtraAction}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
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
                    className="w-full lg:w-auto text-green-600 border-green-200 hover:bg-green-50"
                    disabled={selectedPendientesCount === 0}
                    onClick={() => handleBulkWhatsApp(pendientes)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp Masivo ({selectedPendientesCount})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={selectedPendientesCount === 0}
                    onClick={() => handleCopySelected(pendientes)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({selectedPendientesCount})
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() =>
                        handleExportExcel(pendientes, "pendientes")
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
                  filters={filtersPendiente}
                  onFiltersChange={setFiltersPendiente}
                />
                {renderPendientesTable(pendientes, activeTab === "todas")}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(pendientes.length / 10) || 1}
                totalItems={pendientes.length}
                itemsPerPage={10}
                onPageChange={() => {}}
                itemName="ventas"
              />
            </Card>
          </TabsContent>

          {/* Tab Anuladas */}
          <TabsContent value="anuladas">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle>Ventas Anuladas</CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                    extraActions={bulkExtraActions}
                    onExtraAction={handleBulkExtraAction}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
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
                    className="w-full lg:w-auto text-green-600 border-green-200 hover:bg-green-50"
                    disabled={
                      anulados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleBulkWhatsApp(anulados)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp Masivo (
                    {anulados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
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
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() => handleExportExcel(anulados, "anuladas")}
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
                />
                {renderAnuladosTable(anulados, activeTab === "todas")}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(anulados.length / 10) || 1}
                totalItems={anulados.length}
                itemsPerPage={10}
                onPageChange={() => {}}
                itemName="ventas"
              />
            </Card>
          </TabsContent>

          {/* Tab Todas las Ventas */}
          <TabsContent value="todas">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle>Todas las Ventas</CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                    extraActions={bulkExtraActions}
                    onExtraAction={handleBulkExtraAction}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
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
                    className="w-full lg:w-auto text-green-600 border-green-200 hover:bg-green-50"
                    disabled={
                      todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleBulkWhatsApp(todasLasVentas)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp Masivo (
                    {
                      todasLasVentas.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
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
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() =>
                        handleExportExcel(todasLasVentas, "todas_las_ventas")
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
                />
                {renderPendientesTable(
                  todasLasVentas.slice(
                    (pageAll - 1) * ITEMS_PER_PAGE,
                    pageAll * ITEMS_PER_PAGE,
                  ),
                  activeTab === "todas",
                )}
              </CardContent>
              <Pagination
                currentPage={pageAll}
                totalPages={
                  Math.ceil(todasLasVentas.length / ITEMS_PER_PAGE) || 1
                }
                totalItems={todasLasVentas.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPageAll}
                itemName="ventas"
              />
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CustomerServiceModal
        open={receiptOpen}
        orderId={selectedOrderId || ""}
        onClose={() => {
          setReceiptOpen(false);
          setSelectedShippingGuide(null);
        }}
        onOrderUpdated={refetchOrders}
        hideCallManagement={true}
        shippingGuide={selectedShippingGuide}
        showTracking={activeTab === "todas"}
      />

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
        onPaymentUpdated={refetchOrders}
      />

      {/* Modal de confirmación de impresión */}
      <AlertDialog open={printConfirmOpen} onOpenChange={setPrintConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Se imprimieron correctamente los recibos?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground text-sm">
                <span className="block">
                  Confirma que los siguientes{" "}
                  <strong>{pendingPrintSales.length}</strong> recibo(s) se
                  imprimieron correctamente:
                </span>
                <span className="block max-h-32 overflow-y-auto bg-muted/50 rounded p-2 text-sm">
                  {pendingPrintSales.map((s) => s.orderNumber).join(", ")}
                </span>
                <span className="block text-amber-600 font-medium">
                  Al confirmar, los estados cambiarán a PREPARADO.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelPrint}
              disabled={isPrinting}
            >
              No, cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPrint}
              disabled={isPrinting}
            >
              {isPrinting ? "Actualizando..." : "Sí, confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

      <ImportSalesModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          refetchOrders();
          setImportModalOpen(false);
        }}
        storeId={selectedStoreId || ""}
        userId={auth.user?.id}
        sellerName={
          auth.user
            ? `${auth.user.name || ""} ${auth.user.surname || ""}`.trim()
            : undefined
        }
      />

      <RescheduleDialog
        open={rescheduleDialogSaleId !== null}
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

      {saleToReassign && (
        <ReassignSellerModal
          open={reassignSellerModalOpen}
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
