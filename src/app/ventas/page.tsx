"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Label } from "@/components/ui/label";

import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import CustomerServiceModal, {
  ShippingGuideData,
} from "@/components/modals/CustomerServiceModal";
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
import { getAvailableStatuses } from "@/utils/domain/orders-status-flow";
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
  const [activeTab, setActiveTab] = useState("pendientes");
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(
    new Set(),
  );

  const { auth, selectedStoreId } = useAuth();
  const router = useRouter();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      const mappedSales = res.data.map(mapOrderToSale);
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
    } catch (error) {
      console.error("Error fetching orders", error);
    }
  }, [selectedStoreId]);

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
      const payload: { status: OrderStatus; cancellationReason?: string } = {
        status: newStatus,
      };
      if (cancellationReason) {
        payload.cancellationReason = cancellationReason;
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleId}`,
        payload,
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchOrders();
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
  };

  const toggleSale = (id: string) => {
    setSelectedSaleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!selectedStoreId) return;
    fetchOrders();
  }, [selectedStoreId, fetchOrders]);

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}`,
      );
      toast.success("Venta eliminada");
      fetchOrders();
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

    for (const sale of pendingPrintSales) {
      const newStatus = "PREPARADO";
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}`,
          { status: newStatus },
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

    fetchOrders();
    setSelectedSaleIds(new Set());
    setPendingPrintSales([]);
    setPrintConfirmOpen(false);
    setIsPrinting(false);
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
      setSelectedSaleIds(new Set());
    } catch (error) {
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
    } finally {
      setIsPrinting(false);
    }
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

  // Tabla para Pendientes (sin delete)
  const renderPendientesTable = (
    data: Sale[],
    showTracking: boolean = false,
  ) => (
    <div className="overflow-x-auto border rounded-md">
      <Table className={showTracking ? "min-w-[2200px]" : "min-w-[1600px]"}>
        <TableHeader>
          <TableRow>
            {/* Columnas fijas izquierda */}
            <TableHead className="w-[45px] min-w-[45px] lg:sticky lg:left-0 lg:z-20 bg-background">
              <input
                type="checkbox"
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
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
            <TableHead className="lg:sticky lg:left-[45px] w-[100px] min-w-[100px] lg:z-20 bg-background text-xs">
              N° Orden
            </TableHead>
            <TableHead className="lg:sticky lg:left-[145px] w-[150px] min-w-[150px] lg:z-20 bg-background border-r">
              Cliente
            </TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Distrito</TableHead>
            <TableHead className="border-r">Zona</TableHead>
            {/* Columnas scrolleables */}
            <TableHead>Ciudad</TableHead>
            <TableHead>Provincia</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Envío</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Adelanto</TableHead>
            <TableHead>Por Cobrar</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Region</TableHead>
            {showTracking && (
              <>
                <TableHead>Nro Tracking</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Clave</TableHead>
                <TableHead>Oficina</TableHead>
              </>
            )}
            {/* Columnas fijas derecha */}
            <TableHead className="lg:sticky lg:right-[140px] w-[100px] min-w-[100px] lg:z-20 bg-background border-l">
              Resumen
            </TableHead>
            <TableHead className="lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-20 bg-background text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((sale) => (
            <TableRow key={sale.id}>
              {/* Columnas fijas izquierda */}
              <TableCell className="lg:sticky lg:left-0 w-[45px] min-w-[45px] lg:z-10 bg-background">
                <input
                  type="checkbox"
                  checked={selectedSaleIds.has(sale.id)}
                  onChange={() => toggleSale(sale.id)}
                />
              </TableCell>
              <TableCell className="font-medium lg:sticky lg:left-[45px] w-[100px] min-w-[100px] lg:z-10 bg-background text-xs">
                <div className="flex items-center gap-1">
                  {sale.hasStockIssue && (
                    <span title="Stock insuficiente - No se puede preparar">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </span>
                  )}
                  {sale.orderNumber}
                </div>
              </TableCell>
              <TableCell className="lg:sticky lg:left-[145px] w-[150px] min-w-[150px] lg:z-10 bg-background text-xs truncate max-w-[150px] border-r">
                {sale.clientName}
              </TableCell>
              {/* Columnas scrolleables */}
              <TableCell className="text-xs">{sale.phoneNumber}</TableCell>
              <TableCell className="text-xs truncate max-w-[120px]">
                {sale.district || "-"}
              </TableCell>
              <TableCell className="text-xs truncate max-w-[120px]">
                {sale.zone || "-"}
              </TableCell>
              <TableCell>{sale.city || "-"}</TableCell>
              <TableCell>{sale.province || "-"}</TableCell>
              <TableCell>{sale.date}</TableCell>
              <TableCell>{sale.paymentMethod}</TableCell>
              <TableCell>{sale.deliveryType}</TableCell>
              <TableCell>${sale.total.toFixed(2)}</TableCell>
              <TableCell className="text-green-600">
                ${sale.advancePayment.toFixed(2)}
              </TableCell>
              <TableCell className="text-red-600">
                ${sale.pendingPayment.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs">{sale.sellerName || "—"}</TableCell>
              <TableCell>
                <select
                  value={sale.status}
                  onChange={(e) =>
                    handleChangeStatus(sale.id, e.target.value as OrderStatus)
                  }
                  className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
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
              <TableCell>{sale.salesRegion}</TableCell>
              {showTracking && (
                <>
                  {/* Nro Tracking */}
                  <TableCell>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        className={`w-28 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                          savingOrderId === sale.id
                            ? "opacity-50 border-orange-400 pr-5"
                            : "focus:border-orange-500"
                        }`}
                        placeholder="Nro..."
                        value={
                          trackingEdits[sale.id]?.externalTrackingNumber || ""
                        }
                        onChange={(e) =>
                          updateTrackingField(
                            sale.id,
                            "externalTrackingNumber",
                            e.target.value,
                          )
                        }
                        onBlur={() => handleSaveTracking(sale.id)}
                        disabled={savingOrderId === sale.id}
                      />
                      {savingOrderId === sale.id && (
                        <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin text-orange-500" />
                      )}
                    </div>
                  </TableCell>
                  {/* Código */}
                  <TableCell>
                    <input
                      type="text"
                      className={`w-16 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                        savingOrderId === sale.id
                          ? "opacity-50 border-orange-400"
                          : "focus:border-orange-500"
                      }`}
                      placeholder="Código"
                      value={trackingEdits[sale.id]?.shippingCode || ""}
                      onChange={(e) =>
                        updateTrackingField(
                          sale.id,
                          "shippingCode",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleSaveTracking(sale.id)}
                      disabled={savingOrderId === sale.id}
                    />
                  </TableCell>
                  {/* Clave */}
                  <TableCell>
                    <input
                      type="text"
                      className={`w-16 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                        savingOrderId === sale.id
                          ? "opacity-50 border-orange-400"
                          : "focus:border-orange-500"
                      }`}
                      placeholder="Clave"
                      value={trackingEdits[sale.id]?.shippingKey || ""}
                      onChange={(e) =>
                        updateTrackingField(
                          sale.id,
                          "shippingKey",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleSaveTracking(sale.id)}
                      disabled={savingOrderId === sale.id}
                    />
                  </TableCell>
                  {/* Oficina */}
                  <TableCell>
                    <input
                      type="text"
                      className={`w-28 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                        savingOrderId === sale.id
                          ? "opacity-50 border-orange-400"
                          : "focus:border-orange-500"
                      }`}
                      placeholder="Oficina..."
                      value={trackingEdits[sale.id]?.shippingOffice || ""}
                      onChange={(e) =>
                        updateTrackingField(
                          sale.id,
                          "shippingOffice",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleSaveTracking(sale.id)}
                      disabled={savingOrderId === sale.id}
                    />
                  </TableCell>
                </>
              )}
              {/* Columnas fijas derecha */}
              <TableCell className="lg:sticky lg:right-[140px] w-[100px] min-w-[100px] lg:z-10 bg-background border-l">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenReceipt(sale)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Ver
                </Button>
              </TableCell>
              <TableCell className="lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-10 bg-background text-right">
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
                </div>
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={22}
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
  const renderAnuladosTable = (data: Sale[], showTracking: boolean = false) => (
    <div className="overflow-x-auto border rounded-md">
      <Table className={showTracking ? "min-w-[2200px]" : "min-w-[1600px]"}>
        <TableHeader>
          <TableRow>
            {/* Columnas fijas izquierda */}
            <TableHead className="w-[45px] min-w-[45px] lg:sticky lg:left-0 lg:z-20 bg-background">
              <input
                type="checkbox"
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
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
            <TableHead className="lg:sticky lg:left-[45px] w-[100px] min-w-[100px] lg:z-20 bg-background text-xs">
              N° Orden
            </TableHead>
            <TableHead className="lg:sticky lg:left-[145px] w-[150px] min-w-[150px] lg:z-20 bg-background border-r">
              Cliente
            </TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Distrito</TableHead>
            <TableHead className="border-r">Zona</TableHead>
            {/* Columnas scrolleables */}
            <TableHead>Ciudad</TableHead>
            <TableHead>Provincia</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Envío</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Adelanto</TableHead>
            <TableHead>Por Cobrar</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Region</TableHead>
            {showTracking && (
              <>
                <TableHead>Nro Tracking</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Clave</TableHead>
                <TableHead>Oficina</TableHead>
              </>
            )}
            {/* Columnas fijas derecha */}
            <TableHead className="lg:sticky lg:right-[140px] w-[100px] min-w-[100px] lg:z-20 bg-background border-l">
              Resumen
            </TableHead>
            <TableHead className="lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-20 bg-background text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((sale) => (
            <TableRow key={sale.id}>
              {/* Columnas fijas izquierda */}
              <TableCell className="lg:sticky lg:left-0 w-[45px] min-w-[45px] lg:z-10 bg-background">
                <input
                  type="checkbox"
                  checked={selectedSaleIds.has(sale.id)}
                  onChange={() => toggleSale(sale.id)}
                />
              </TableCell>
              <TableCell className="font-medium lg:sticky lg:left-[45px] w-[100px] min-w-[100px] lg:z-10 bg-background text-xs">
                {sale.orderNumber}
              </TableCell>
              <TableCell className="lg:sticky lg:left-[145px] w-[150px] min-w-[150px] lg:z-10 bg-background text-xs truncate max-w-[150px] border-r">
                {sale.clientName}
              </TableCell>
              {/* Columnas scrolleables */}
              <TableCell className="text-xs">{sale.phoneNumber}</TableCell>
              <TableCell className="text-xs truncate max-w-[120px]">
                {sale.district || "-"}
              </TableCell>
              <TableCell className="text-xs truncate max-w-[120px]">
                {sale.zone || "-"}
              </TableCell>
              <TableCell>{sale.city || "-"}</TableCell>
              <TableCell>{sale.province || "-"}</TableCell>
              <TableCell>{sale.date}</TableCell>
              <TableCell>{sale.paymentMethod}</TableCell>
              <TableCell>{sale.deliveryType}</TableCell>
              <TableCell>${sale.total.toFixed(2)}</TableCell>
              <TableCell className="text-green-600">
                ${sale.advancePayment.toFixed(2)}
              </TableCell>
              <TableCell className="text-red-600">
                ${sale.pendingPayment.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs">{sale.sellerName || "—"}</TableCell>
              <TableCell>
                <select
                  value={sale.status}
                  onChange={(e) =>
                    handleChangeStatus(sale.id, e.target.value as OrderStatus)
                  }
                  className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
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
              <TableCell>{sale.salesRegion}</TableCell>
              {showTracking && (
                <>
                  {/* Nro Tracking */}
                  <TableCell>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        className={`w-28 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                          savingOrderId === sale.id
                            ? "opacity-50 border-orange-400 pr-5"
                            : "focus:border-orange-500"
                        }`}
                        placeholder="Nro..."
                        value={
                          trackingEdits[sale.id]?.externalTrackingNumber || ""
                        }
                        onChange={(e) =>
                          updateTrackingField(
                            sale.id,
                            "externalTrackingNumber",
                            e.target.value,
                          )
                        }
                        onBlur={() => handleSaveTracking(sale.id)}
                        disabled={savingOrderId === sale.id}
                      />
                      {savingOrderId === sale.id && (
                        <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin text-orange-500" />
                      )}
                    </div>
                  </TableCell>
                  {/* Código */}
                  <TableCell>
                    <input
                      type="text"
                      className={`w-16 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                        savingOrderId === sale.id
                          ? "opacity-50 border-orange-400"
                          : "focus:border-orange-500"
                      }`}
                      placeholder="Código"
                      value={trackingEdits[sale.id]?.shippingCode || ""}
                      onChange={(e) =>
                        updateTrackingField(
                          sale.id,
                          "shippingCode",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleSaveTracking(sale.id)}
                      disabled={savingOrderId === sale.id}
                    />
                  </TableCell>
                  {/* Clave */}
                  <TableCell>
                    <input
                      type="text"
                      className={`w-16 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                        savingOrderId === sale.id
                          ? "opacity-50 border-orange-400"
                          : "focus:border-orange-500"
                      }`}
                      placeholder="Clave"
                      value={trackingEdits[sale.id]?.shippingKey || ""}
                      onChange={(e) =>
                        updateTrackingField(
                          sale.id,
                          "shippingKey",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleSaveTracking(sale.id)}
                      disabled={savingOrderId === sale.id}
                    />
                  </TableCell>
                  {/* Oficina */}
                  <TableCell>
                    <input
                      type="text"
                      className={`w-28 h-7 px-1.5 text-xs border rounded bg-background transition-all ${
                        savingOrderId === sale.id
                          ? "opacity-50 border-orange-400"
                          : "focus:border-orange-500"
                      }`}
                      placeholder="Oficina..."
                      value={trackingEdits[sale.id]?.shippingOffice || ""}
                      onChange={(e) =>
                        updateTrackingField(
                          sale.id,
                          "shippingOffice",
                          e.target.value,
                        )
                      }
                      onBlur={() => handleSaveTracking(sale.id)}
                      disabled={savingOrderId === sale.id}
                    />
                  </TableCell>
                </>
              )}
              {/* Columnas fijas derecha */}
              <TableCell className="lg:sticky lg:right-[140px] w-[100px] min-w-[100px] lg:z-10 bg-background border-l">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenReceipt(sale)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Ver
                </Button>
              </TableCell>
              <TableCell className="lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-10 bg-background text-right">
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
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={22}
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

  const selectedPendientesCount = pendientes.filter((s) =>
    selectedSaleIds.has(s.id),
  ).length;

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex flex-col items-center mb-6">
          <HeaderConfig
            title="Ventas"
            description="Gestión de ventas pendientes y anuladas"
          />
        </div>

        <div className="flex flex-col lg:flex-row justify-end gap-2 mb-4">
          <Link href="/registrar-venta" className="w-full lg:w-auto">
            <Button className="w-full lg:w-auto bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva venta
            </Button>
          </Link>
        </div>

        {/* Tabs para Ventas */}
        <Tabs
          defaultValue="pendientes"
          className="w-full"
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="pendientes">
              Ventas Pendientes ({pendientes.length})
            </TabsTrigger>
            <TabsTrigger value="anuladas">
              Ventas Anuladas ({anulados.length})
            </TabsTrigger>
            <TabsTrigger value="todas">
              Todas las Ventas ({todasLasVentas.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Pendientes */}
          <TabsContent value="pendientes">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle>Ventas Pendientes</CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
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
        onOrderUpdated={fetchOrders}
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
        onPaymentUpdated={fetchOrders}
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
    </div>
  );
}
