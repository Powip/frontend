"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Pencil,
  Trash2,
  FileText,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  StickyNote,
  AlertTriangle,
  PackagePlus,
  Eye,
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
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
import { Copy, Printer, Truck, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CancellationModal, {
  CancellationReason,
} from "@/components/modals/CancellationModal";
import CourierAssignmentModal from "@/components/modals/CourierAssignmentModal";
import {
  getAvailableStatuses,
  ORDER_STATUS_FLOW,
} from "@/utils/domain/orders-status-flow";
import { printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";
import CommentsTimelineModal from "@/components/modals/CommentsTimelineModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import CreateGuideModal, {
  CreateGuideData,
} from "@/components/modals/CreateGuideModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import { Badge } from "@/components/ui/badge";
import { exportSalesToExcel, SaleExportData } from "@/utils/exportSalesExcel";
import AddToExistingGuideModal from "@/components/modals/AddToExistingGuideModal";
import { BulkStatusSelect } from "@/components/ventas/BulkStatusSelect";
import { processBulkStatusChange } from "@/utils/bulkStatusUtils";

/* -----------------------------------------
   Types
----------------------------------------- */

const ORDER_STATUS = {
  PENDIENTE: "PENDIENTE",
  PREPARADO: "PREPARADO",
  LLAMADO: "LLAMADO",
  ASIGNADO_A_GUIA: "ASIGNADO_A_GUIA",
  EN_ENVIO: "EN_ENVIO",
  ENTREGADO: "ENTREGADO",
  ANULADO: "ANULADO",
};

const ALL_STATUSES: OrderStatus[] = [
  "PENDIENTE",
  "PREPARADO",
  "LLAMADO",
  "ASIGNADO_A_GUIA",
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
  province?: string;
  city?: string;
  district: string;
  address: string;
  advancePayment: number;
  pendingPayment: number;
  notes: string;
  courier?: string | null;
  courierId?: string | null;
  guideNumber?: string | null;
  hasStockIssue?: boolean;
  zone?: string;
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | "SCHEDULED" | null;
  hasPendingApprovalPayments: boolean;
  sellerName: string | null;
  externalSource?: string | null;
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
    courier: order.courier ?? null,
    courierId: order.courierId ?? null,
    status: order.status,
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
    salesRegion: order.salesRegion,
    province: order.customer.province ?? "",
    city: order.customer.city ?? "",
    district: order.customer.district ?? "",
    address: order.customer.address ?? "",
    advancePayment,
    pendingPayment,
    notes: order.notes ?? "",
    hasStockIssue: order.hasStockIssue ?? false,
    zone: order.customer.zone ?? undefined,
    guideNumber: order.guideNumber ?? null,
    callStatus: order.callStatus,
    hasPendingApprovalPayments,
    sellerName: order.sellerName ?? null,
    externalSource: order.externalSource ?? null,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function OperacionesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<Sale | null>(
    null,
  );
  const [selectedShippingGuide, setSelectedShippingGuide] =
    useState<ShippingGuideData | null>(null);

  // Modal de observaciones
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedSaleForNotes, setSelectedSaleForNotes] = useState<Sale | null>(
    null,
  );
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Filtros avanzados
  const [filtersPreparados, setFiltersPreparados] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersNoConfirmados, setFiltersNoConfirmados] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersConfirmados, setFiltersConfirmados] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersContactados, setFiltersContactados] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersDespachados, setFiltersDespachados] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersEntregados, setFiltersEntregados] =
    useState<SalesFilters>(emptySalesFilters);
  const [filtersAnulados, setFiltersAnulados] =
    useState<SalesFilters>(emptySalesFilters);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Paginación
  const ITEMS_PER_PAGE = 10;
  const [pageEntregados, setPageEntregados] = useState(1);
  const [pageAnulados, setPageAnulados] = useState(1);

  const [activeTab, setActiveTab] = useState("preparados");

  // Estados de selección independientes por pestaña
  const [selectedPreparadosIds, setSelectedPreparadosIds] = useState<
    Set<string>
  >(new Set());
  const [selectedNoConfirmadosIds, setSelectedNoConfirmadosIds] = useState<
    Set<string>
  >(new Set());
  const [selectedConfirmadosIds, setSelectedConfirmadosIds] = useState<
    Set<string>
  >(new Set());
  const [selectedContactadosIds, setSelectedContactadosIds] = useState<
    Set<string>
  >(new Set());
  const [selectedDespachadosIds, setSelectedDespachadosIds] = useState<
    Set<string>
  >(new Set());
  const [selectedEntregadosIds, setSelectedEntregadosIds] = useState<
    Set<string>
  >(new Set());
  const [selectedAnuladosOpsIds, setSelectedAnuladosOpsIds] = useState<
    Set<string>
  >(new Set());

  // Helper para obtener el set actual según la pestaña
  const getSelectedIdsForActiveTab = useCallback(() => {
    switch (activeTab) {
      case "preparados":
        return selectedPreparadosIds;
      case "no_confirmados":
        return selectedNoConfirmadosIds;
      case "confirmados":
        return selectedConfirmadosIds;
      case "contactados":
        return selectedContactadosIds;
      case "despachados":
        return selectedDespachadosIds;
      case "entregados":
        return selectedEntregadosIds;
      case "anulados":
        return selectedAnuladosOpsIds;
      default:
        return new Set<string>();
    }
  }, [
    activeTab,
    selectedPreparadosIds,
    selectedNoConfirmadosIds,
    selectedConfirmadosIds,
    selectedContactadosIds,
    selectedDespachadosIds,
    selectedEntregadosIds,
    selectedAnuladosOpsIds,
  ]);

  // Helper para setear el set actual según la pestaña
  const setSelectedIdsForActiveTab = useCallback(
    (newSet: Set<string>) => {
      switch (activeTab) {
        case "preparados":
          setSelectedPreparadosIds(newSet);
          break;
        case "no_confirmados":
          setSelectedNoConfirmadosIds(newSet);
          break;
        case "confirmados":
          setSelectedConfirmadosIds(newSet);
          break;
        case "contactados":
          setSelectedContactadosIds(newSet);
          break;
        case "despachados":
          setSelectedDespachadosIds(newSet);
          break;
        case "entregados":
          setSelectedEntregadosIds(newSet);
          break;
        case "anulados":
          setSelectedAnuladosOpsIds(newSet);
          break;
      }
    },
    [activeTab],
  );

  const selectedSaleIds = getSelectedIdsForActiveTab();

  // Estado para modal de cancelación
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Estado para modal de asignación de courier
  const [courierModalOpen, setCourierModalOpen] = useState(false);
  const [isAssigningCourier, setIsAssigningCourier] = useState(false);

  // Estado para modal de comentarios/timeline
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedSaleForComments, setSelectedSaleForComments] =
    useState<Sale | null>(null);

  // Estado para modal de pagos
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] =
    useState<Sale | null>(null);

  // Estado para modal de crear guía
  const [createGuideModalOpen, setCreateGuideModalOpen] = useState(false);
  const [isCreatingGuide, setIsCreatingGuide] = useState(false);

  // Estado para modal de ver guía
  const [guideDetailsModalOpen, setGuideDetailsModalOpen] = useState(false);
  const [selectedSaleForGuide, setSelectedSaleForGuide] = useState<Sale | null>(
    null,
  );

  // Estado para modal de agregar a guía existente
  const [addToGuideModalOpen, setAddToGuideModalOpen] = useState(false);
  const [isAddingToGuide, setIsAddingToGuide] = useState(false);

  const { auth, selectedStoreId } = useAuth();
  const router = useRouter();

  // Calcular estados disponibles comunes para la selección de la pestaña activa
  const bulkAvailableStatuses = useMemo(() => {
    const currentSelectedIds = getSelectedIdsForActiveTab();
    if (currentSelectedIds.size === 0) return [];

    const selectedSalesList = sales.filter((s) => currentSelectedIds.has(s.id));
    if (selectedSalesList.length === 0) return [];

    // Si hay alguna anulada, no permitimos cambios masivos
    if (selectedSalesList.some((s) => s.status === "ANULADO")) return [];

    let intersection: OrderStatus[] = [];

    selectedSalesList.forEach((sale, index) => {
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
  }, [
    selectedPreparadosIds,
    selectedNoConfirmadosIds,
    selectedConfirmadosIds,
    selectedContactadosIds,
    selectedDespachadosIds,
    selectedEntregadosIds,
    selectedAnuladosOpsIds,
    activeTab,
    sales,
  ]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );

      const mappedSales = res.data.map(mapOrderToSale);

      // Enriquecer órdenes con guideNumber que no tienen courier con el courierName de la guía
      const ordersNeedingCourier = mappedSales.filter(
        (sale) => sale.guideNumber && !sale.courier,
      );

      if (ordersNeedingCourier.length > 0) {
        // Buscar courierName para cada orden que lo necesite
        const enrichedSales = await Promise.all(
          mappedSales.map(async (sale) => {
            if (sale.guideNumber && !sale.courier) {
              try {
                const guideRes = await axios.get(
                  `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${sale.id}`,
                );
                if (guideRes.data?.courierName) {
                  return { ...sale, courier: guideRes.data.courierName };
                }
              } catch {
                // Si falla, mantener la venta sin cambios
              }
            }
            return sale;
          }),
        );
        setSales(enrichedSales);
      } else {
        setSales(mappedSales);
      }
    } catch (error) {
      console.error("Error fetching orders", error);
    }
  }, [selectedStoreId]);

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

    // Validar courier antes de cambiar a EN_ENVIO (solo si no es retiro en tienda)
    if (newStatus === "EN_ENVIO") {
      const sale = sales.find((s) => s.id === saleId);
      const isPickup = sale?.deliveryType.toUpperCase().includes("RETIRO");
      if (sale && !sale.courier && !isPickup) {
        toast.error("Debe asignar un courier antes de cambiar a EN_ENVIO");
        return;
      }
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
      fetchOrders();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      if (backendMessage) {
        toast.error(backendMessage, { duration: 8000 });
      } else {
        console.error("Error actualizando estado", error);
        toast.error("No se pudo actualizar el estado");
      }
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

    // Validar si algún pedido requiere courier antes de pasar a EN_ENVIO masivamente
    if (newStatus === "EN_ENVIO") {
      const ordersMissingCourier = sales.filter(
        (s) =>
          selectedSaleIds.has(s.id) &&
          !s.courier &&
          !s.deliveryType.toUpperCase().includes("RETIRO"),
      );
      if (ordersMissingCourier.length > 0) {
        toast.error(
          `Hay ${ordersMissingCourier.length} pedido(s) sin courier asignado. No se puede proceder a EN_ENVIO.`,
        );
        return;
      }
    }

    setIsBulkLoading(true);
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_VENTAS || "";

    try {
      const uInfo = getUserInfo();
      const result = await processBulkStatusChange(
        selectedIds,
        newStatus,
        apiBaseUrl,
        undefined,
        15,
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
            description:
              "Verifique las reglas de transición de estado o asignación de courier.",
            duration: 6000,
          },
        );
      }

      setSelectedIdsForActiveTab(new Set());
      fetchOrders();
    } catch (error) {
      toast.error("Error crítico durante la actualización masiva.");
    } finally {
      setIsBulkLoading(false);
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
      fetchOrders();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      if (backendMessage) {
        toast.error(backendMessage);
      } else {
        console.error("Error anulando venta", error);
        toast.error("No se pudo anular la venta");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  // Obtener ventas seleccionadas con guía (ASIGNADO_A_GUIA) para ver
  const getSelectedConGuia = () => {
    return contactados.filter(
      (s) =>
        selectedSaleIds.has(s.id) && s.status === ORDER_STATUS.ASIGNADO_A_GUIA,
    );
  };

  const handleAssignCourier = async (courier: string, courierId?: string) => {
    const eligibleSales = getSelectedConGuia();

    if (eligibleSales.length === 0) {
      toast.warning("No hay pedidos seleccionados con guía asignada");
      return;
    }

    setIsAssigningCourier(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const sale of eligibleSales) {
        try {
          await axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}`,
            {
              status: "EN_ENVIO",
              courier: courier,
              courierId: courierId || null,
              ...getUserInfo(),
            },
          );
          successCount++;
        } catch (error) {
          console.error(`Error asignando courier a ${sale.orderNumber}`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} pedido(s) asignados y despachados`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} pedido(s) no pudieron ser actualizados`);
      }

      setCourierModalOpen(false);
      setSelectedIdsForActiveTab(new Set());
      fetchOrders();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      if (backendMessage) {
        toast.error(backendMessage);
      } else {
        console.error("Error en asignación de courier", error);
        toast.error("Error al asignar courier");
      }
    } finally {
      setIsAssigningCourier(false);
    }
  };

  // Obtener ventas seleccionadas en estado LLAMADO para crear guía
  const getSelectedLlamadosForGuide = () => {
    return contactados.filter(
      (s) =>
        selectedSaleIds.has(s.id) &&
        s.status === ORDER_STATUS.LLAMADO &&
        s.deliveryType.toUpperCase() === "DOMICILIO",
    );
  };

  // Crear guía(s) de envío y actualizar órdenes con el guideNumber
  const handleCreateGuide = async (guidesData: CreateGuideData[]) => {
    setIsCreatingGuide(true);
    try {
      const createdGuides: string[] = [];
      let totalOrders = 0;

      // Crear una guía por cada grupo de zona
      for (const guideData of guidesData) {
        const guideResponse = await axios.post(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides`,
          guideData,
        );

        const guideNumber = guideResponse.data.guideNumber;
        createdGuides.push(guideNumber);
        totalOrders += guideData.orderIds.length;

        // Guardar el guideNumber y cambiar el estado a EN_ENVIO
        for (const orderId of guideData.orderIds) {
          const carrierCost = guideData.orderCarrierCosts?.[orderId] || 0;
          await axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
            {
              guideNumber: guideNumber,
              status: "EN_ENVIO",
              courier: guideData.courierName,
              courierId: guideData.courierId || null,
              carrierShippingCost: carrierCost,
              ...getUserInfo(),
            },
          );
        }
      }

      if (createdGuides.length === 1) {
        toast.success(
          `Guía ${createdGuides[0]} creada con ${totalOrders} pedido(s)`,
        );
      } else {
        toast.success(
          `${createdGuides.length} guías creadas (${createdGuides.join(", ")}) con ${totalOrders} pedido(s)`,
        );
      }

      setCreateGuideModalOpen(false);
      setSelectedIdsForActiveTab(new Set());
      fetchOrders();

      // Abrir modal de detalles de la primera guía creada
      if (guidesData.length > 0 && guidesData[0].orderIds.length > 0) {
        setSelectedSaleForGuide({ id: guidesData[0].orderIds[0] } as Sale);
        setGuideDetailsModalOpen(true);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Error creando guía";
      toast.error(message);
    } finally {
      setIsCreatingGuide(false);
    }
  };

  const handleOpenNotes = (sale: Sale) => {
    setSelectedSaleForNotes(sale);
    setNotesText(sale.notes || "");
    setNotesOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedSaleForNotes) return;
    setSavingNotes(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${selectedSaleForNotes.id}`,
        { notes: notesText },
      );
      toast.success("Observaciones guardadas");
      setNotesOpen(false);
      fetchOrders();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      if (backendMessage) {
        toast.error(backendMessage);
      } else {
        console.error("Error guardando observaciones", error);
        toast.error("No se pudo guardar");
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddToExistingGuide = async (
    guideId: string,
    guideNumber: string,
  ) => {
    const selectedLlamados = getSelectedLlamadosForGuide();
    if (selectedLlamados.length === 0) {
      toast.warning("No hay pedidos aptos seleccionados");
      return;
    }

    setIsAddingToGuide(true);
    try {
      // 1. Agregar órdenes en ms-courier
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}/orders`,
        { orderIds: selectedLlamados.map((s) => s.id) },
      );

      // 2. Actualizar cada orden en ms-ventas con el número de guía y nuevo estado
      for (const sale of selectedLlamados) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}`,
          {
            guideNumber: guideNumber,
            status: "EN_ENVIO",
            ...getUserInfo(),
          },
        );
      }

      toast.success(
        `${selectedLlamados.length} pedido(s) agregados a la guía ${guideNumber}`,
      );
      setAddToGuideModalOpen(false);
      setSelectedIdsForActiveTab(new Set());
      fetchOrders();
    } catch (error: any) {
      console.error("Error adding to guide:", error);
      const message =
        error?.response?.data?.message || "Error al agregar a la guía";
      toast.error(message);
    } finally {
      setIsAddingToGuide(false);
    }
  };

  const handleWhatsApp = (
    phoneNumber: string,
    orderNumber?: string,
    clientName?: string,
  ) => {
    // Limpiar el número de caracteres no numéricos
    let cleanPhone = phoneNumber.replace(/\D/g, "");

    // Si el número no empieza con 51 (código de Perú), agregarlo
    if (!cleanPhone.startsWith("51")) {
      // Si empieza con 0, quitarlo (ej: 0987654321 -> 987654321)
      if (cleanPhone.startsWith("0")) {
        cleanPhone = cleanPhone.substring(1);
      }
      cleanPhone = `51${cleanPhone}`;
    }

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

  const toggleSale = (id: string) => {
    const next = new Set(selectedSaleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIdsForActiveTab(next);
  };

  useEffect(() => {
    if (!selectedStoreId) return;
    fetchOrders();
  }, [selectedStoreId, fetchOrders]);

  const handleDelete = (id: string) => {
    setSales((prev) => prev.filter((sale) => sale.id !== id));
  };

  // Abrir modal de recibo, cargando datos de guía si es EN_ENVIO
  const handleOpenReceipt = async (sale: Sale) => {
    setSelectedOrderId(sale.id);
    setSelectedSaleForModal(sale);

    // Si es EN_ENVIO y tiene guía, cargar datos de la guía
    if (sale.status === "EN_ENVIO" && sale.guideNumber) {
      try {
        const guideRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${sale.id}`,
        );
        const guide = guideRes.data;

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
      } catch (error) {
        console.error("Error fetching shipping guide:", error);
        setSelectedShippingGuide(null);
      }
    } else {
      setSelectedShippingGuide(null);
    }

    setReceiptOpen(true);
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
      status: s.status,
      salesRegion: s.salesRegion,
      province: s.province,
      city: s.city,
      district: s.district,
      zone: s.zone,
      address: s.address,
      paymentMethod: s.paymentMethod,
      deliveryType: s.deliveryType,
      courier: s.courier,
      guideNumber: s.guideNumber,
    }));

    exportSalesToExcel(exportData, `operaciones_${tabName}`);
    toast.success(`Exportados ${salesList.length} registros`);
  };
  const handleBulkPrintForStatus = async (salesList: Sale[]) => {
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

  const renderTable = (
    data: Sale[],
    showWhatsApp: boolean = false,
    showGuideColumn: boolean = false,
  ) => (
    <div className="overflow-x-auto border rounded-md">
      <Table className="min-w-[1800px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[45px] min-w-[45px] lg:sticky lg:left-0 lg:z-20 bg-background">
              <input
                type="checkbox"
                checked={
                  data.length > 0 &&
                  data.every((s) => selectedSaleIds.has(s.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
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
            <TableHead className="lg:sticky lg:left-[45px] w-[100px] min-w-[100px] lg:z-20 bg-background text-xs">
              N° Orden
            </TableHead>
            <TableHead className="lg:sticky lg:left-[145px] w-[150px] min-w-[150px] lg:z-20 bg-background border-r text-xs">
              Cliente
            </TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Envío</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Adelanto</TableHead>
            <TableHead>Por Cobrar</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Estado</TableHead>
            {showGuideColumn && <TableHead>Guía</TableHead>}
            {showGuideColumn && <TableHead>Courier</TableHead>}
            <TableHead>Region</TableHead>
            <TableHead>Distrito</TableHead>
            <TableHead>Zona</TableHead>
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
              <TableCell className="text-xs">{sale.phoneNumber}</TableCell>
              <TableCell className="text-xs">{sale.date}</TableCell>
              <TableCell className="text-xs truncate max-w-[100px]">
                {sale.paymentMethod}
              </TableCell>
              <TableCell className="text-xs truncate max-w-[120px]">
                {sale.deliveryType}
              </TableCell>
              <TableCell>${sale.total.toFixed(2)}</TableCell>
              <TableCell className="text-green-600">
                ${sale.advancePayment.toFixed(2)}
              </TableCell>
              <TableCell className="text-red-600">
                ${sale.pendingPayment.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs">
                {sale.sellerName || "—"}
              </TableCell>
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
              {showGuideColumn && (
                <TableCell>
                  {sale.guideNumber ? (
                    <Badge
                      className="bg-green-100 text-green-800 cursor-pointer hover:bg-green-200"
                      onClick={() => {
                        setSelectedSaleForGuide(sale);
                        setGuideDetailsModalOpen(true);
                      }}
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      Ver Guía
                    </Badge>
                  ) : sale.deliveryType.toUpperCase() === "DOMICILIO" ? (
                    <Badge className="bg-amber-100 text-amber-800">
                      Sin guía
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">N/A</span>
                  )}
                </TableCell>
              )}
              {showGuideColumn && (
                <TableCell>
                  {sale.courier ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Truck className="h-3 w-3 text-muted-foreground" />
                      {sale.courier}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
              )}
              <TableCell>{sale.salesRegion}</TableCell>
              <TableCell>{sale.district}</TableCell>
              <TableCell>
                {sale.zone ? (
                  <Badge
                    className={`text-xs whitespace-nowrap ${
                      sale.zone === "LIMA_NORTE"
                        ? "bg-blue-100 text-blue-800"
                        : sale.zone === "CALLAO"
                          ? "bg-yellow-100 text-yellow-800"
                          : sale.zone === "LIMA_CENTRO"
                            ? "bg-green-100 text-green-800"
                            : sale.zone === "LIMA_SUR"
                              ? "bg-purple-100 text-purple-800"
                              : sale.zone === "LIMA_ESTE"
                                ? "bg-orange-100 text-orange-800"
                                : sale.zone === "ZONAS_ALEDANAS"
                                  ? "bg-gray-100 text-gray-800"
                                  : sale.zone === "PROVINCIAS"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sale.zone === "LIMA_NORTE"
                      ? "🟦 L. Norte"
                      : sale.zone === "CALLAO"
                        ? "🟨 Callao"
                        : sale.zone === "LIMA_CENTRO"
                          ? "🟩 L. Centro"
                          : sale.zone === "LIMA_SUR"
                            ? "🟪 L. Sur"
                            : sale.zone === "LIMA_ESTE"
                              ? "🟧 L. Este"
                              : sale.zone === "ZONAS_ALEDANAS"
                                ? "⛰️ Aledañas"
                                : sale.zone === "PROVINCIAS"
                                  ? "🧭 Provincias"
                                  : sale.zone}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
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
              <TableCell className="text-right space-x-1 lg:sticky lg:right-0 w-[140px] min-w-[140px] lg:z-10 bg-background">
                <div className="flex gap-1 justify-end">
                  {/* WhatsApp */}
                  {showWhatsApp && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="bg-green-500 hover:bg-green-600 text-white"
                      title="Contactar por WhatsApp"
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
                  )}
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
    </div>
  );

  /* -----------------------------------------
     Filters
  ----------------------------------------- */

  // Preparados: Lima y Provincia (sin llamar o pendiente de llamada)
  const preparados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) =>
        s.status === ORDER_STATUS.PREPARADO &&
        (!s.callStatus || s.callStatus === "PENDING"),
    );
    return applyFilters(statusFiltered, filtersPreparados);
  }, [sales, filtersPreparados]);

  // No Confirmados: status = PREPARADO y callStatus = NO_ANSWER
  const noConfirmados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) =>
        s.status === ORDER_STATUS.PREPARADO && s.callStatus === "NO_ANSWER",
    );
    return applyFilters(statusFiltered, filtersNoConfirmados);
  }, [sales, filtersNoConfirmados]);

  // Confirmados: status = LLAMADO (ya confirmaron)
  const confirmados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.status === ORDER_STATUS.LLAMADO,
    );
    return applyFilters(statusFiltered, filtersConfirmados);
  }, [sales, filtersConfirmados]);

  const contactados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) =>
        s.status === ORDER_STATUS.LLAMADO ||
        s.status === ORDER_STATUS.ASIGNADO_A_GUIA,
    );
    return applyFilters(statusFiltered, filtersContactados);
  }, [sales, filtersContactados]);

  const despachados = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.status === ORDER_STATUS.EN_ENVIO,
    );
    return applyFilters(statusFiltered, filtersDespachados);
  }, [sales, filtersDespachados]);

  // Entregados: status = ENTREGADO
  const entregadosAll = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.status === ORDER_STATUS.ENTREGADO,
    );
    return applyFilters(statusFiltered, filtersEntregados);
  }, [sales, filtersEntregados]);

  const entregadosPaginated = useMemo(
    () =>
      entregadosAll.slice(
        (pageEntregados - 1) * ITEMS_PER_PAGE,
        pageEntregados * ITEMS_PER_PAGE,
      ),
    [entregadosAll, pageEntregados],
  );

  // Anulados: status = ANULADO
  const anuladosAll = useMemo(() => {
    const statusFiltered = sales.filter(
      (s) => s.status === ORDER_STATUS.ANULADO,
    );
    return applyFilters(statusFiltered, filtersAnulados);
  }, [sales, filtersAnulados]);

  const anuladosPaginated = useMemo(
    () =>
      anuladosAll.slice(
        (pageAnulados - 1) * ITEMS_PER_PAGE,
        pageAnulados * ITEMS_PER_PAGE,
      ),
    [anuladosAll, pageAnulados],
  );

  // Extraer lista de couriers únicos para el filtro
  const availableCouriers = useMemo(() => {
    const couriers = sales
      .map((s) => s.courier)
      .filter((c): c is string => !!c);
    return [...new Set(couriers)];
  }, [sales]);

  if (!auth) return null;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex flex-col items-center mb-6">
          <HeaderConfig
            title="Operaciones"
            description="Gestión de pedidos preparados, contactados y despachados"
          />
        </div>

        {/* Tabs para Operaciones */}
        <Tabs
          defaultValue="preparados"
          className="w-full"
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="preparados">
              Preparados ({preparados.length})
            </TabsTrigger>
            <TabsTrigger value="no_confirmados" className="text-red-600">
              No Confirmados ({noConfirmados.length})
            </TabsTrigger>
            <TabsTrigger value="contactados" className="text-green-600">
              Contactados ({contactados.length})
            </TabsTrigger>
            <TabsTrigger value="despachados">
              En Envío ({despachados.length})
            </TabsTrigger>
            <TabsTrigger value="entregados" className="text-green-700">
              Entregados ({entregadosAll.length})
            </TabsTrigger>
            <TabsTrigger value="anulados" className="text-gray-500">
              Anulados ({anuladosAll.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Preparados */}
          <TabsContent value="preparados">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle>Pedidos Preparados</CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={ALL_STATUSES.filter(
                      (s) => s !== "ANULADO",
                    )}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      preparados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0 || isPrinting
                    }
                    onClick={() => handleBulkPrintForStatus(preparados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados (
                    {preparados.filter((s) => selectedSaleIds.has(s.id)).length}
                    )
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      preparados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleCopySelected(preparados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados (
                    {preparados.filter((s) => selectedSaleIds.has(s.id)).length}
                    )
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() =>
                        handleExportExcel(preparados, "preparados")
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
                  filters={filtersPreparados}
                  onFiltersChange={setFiltersPreparados}
                  showRegionFilter={true}
                />
                {renderTable(preparados, true, false)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(preparados.length / 10) || 1}
                totalItems={preparados.length}
                itemsPerPage={10}
                onPageChange={() => {}}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab No Confirmados */}
          <TabsContent value="no_confirmados">
            <Card className="border-red-200">
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-red-50">
                <CardTitle className="text-red-700">
                  Pedidos NO CONFIRMADOS
                </CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      noConfirmados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0 || isPrinting
                    }
                    onClick={() => handleBulkPrintForStatus(noConfirmados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados (
                    {
                      noConfirmados.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      noConfirmados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleCopySelected(noConfirmados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados (
                    {
                      noConfirmados.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() =>
                        handleExportExcel(noConfirmados, "no_confirmados")
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
                  filters={filtersNoConfirmados}
                  onFiltersChange={setFiltersNoConfirmados}
                  showRegionFilter={true}
                />
                {renderTable(noConfirmados, true, false)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(noConfirmados.length / 10) || 1}
                totalItems={noConfirmados.length}
                itemsPerPage={10}
                onPageChange={() => {}}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Contactados */}
          <TabsContent value="contactados">
            <Card>
              <CardHeader className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <CardTitle>Pedidos Contactados</CardTitle>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full xl:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                  />
                  <Button
                    variant="default"
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                    disabled={
                      getSelectedLlamadosForGuide().length === 0 ||
                      isCreatingGuide
                    }
                    onClick={() => setCreateGuideModalOpen(true)}
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Generar Guía ({getSelectedLlamadosForGuide().length})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                    disabled={
                      getSelectedLlamadosForGuide().length === 0 ||
                      isAddingToGuide
                    }
                    onClick={() => setAddToGuideModalOpen(true)}
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Agregar a Guía ({getSelectedLlamadosForGuide().length})
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={
                      contactados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0 || isPrinting
                    }
                    onClick={() => handleBulkPrintForStatus(contactados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir (
                    {
                      contactados.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={
                      contactados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleCopySelected(contactados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar (
                    {
                      contactados.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        handleExportExcel(contactados, "contactados")
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersContactados}
                  onFiltersChange={setFiltersContactados}
                  showZoneFilter={true}
                  showRegionFilter={true}
                  showGuideFilter={true}
                />
                {renderTable(contactados, true, true)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(contactados.length / 10) || 1}
                totalItems={contactados.length}
                itemsPerPage={10}
                onPageChange={() => {}}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Despachados */}
          <TabsContent value="despachados">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle>Pedidos En Envío</CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      despachados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0 || isPrinting
                    }
                    onClick={() => handleBulkPrintForStatus(despachados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir (
                    {
                      despachados.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      despachados.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleCopySelected(despachados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar (
                    {
                      despachados.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() =>
                        handleExportExcel(despachados, "despachados")
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
                  filters={filtersDespachados}
                  onFiltersChange={setFiltersDespachados}
                  showCourierFilter={true}
                  showZoneFilter={true}
                  showRegionFilter={true}
                  showGuideFilter={true}
                  availableCouriers={availableCouriers}
                />
                {renderTable(despachados, true, true)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(despachados.length / 10) || 1}
                totalItems={despachados.length}
                itemsPerPage={10}
                onPageChange={() => {}}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Entregados */}
          <TabsContent value="entregados">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle className="text-green-700">
                  Pedidos Entregados
                </CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={bulkAvailableStatuses}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      entregadosAll.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0 || isPrinting
                    }
                    onClick={() => handleBulkPrintForStatus(entregadosAll)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir (
                    {
                      entregadosAll.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      entregadosAll.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleCopySelected(entregadosAll)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar (
                    {
                      entregadosAll.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() =>
                        handleExportExcel(entregadosAll, "entregados")
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
                  filters={filtersEntregados}
                  onFiltersChange={(f) => {
                    setFiltersEntregados(f);
                    setPageEntregados(1);
                  }}
                  showCourierFilter={true}
                  showRegionFilter={true}
                  availableCouriers={availableCouriers}
                />
                {renderTable(entregadosPaginated, true, false)}
              </CardContent>
              <Pagination
                currentPage={pageEntregados}
                totalPages={
                  Math.ceil(entregadosAll.length / ITEMS_PER_PAGE) || 1
                }
                totalItems={entregadosAll.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPageEntregados}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Anulados */}
          <TabsContent value="anulados">
            <Card>
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle className="text-gray-500">
                  Pedidos Anulados
                </CardTitle>
                <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
                  <BulkStatusSelect
                    selectedCount={selectedSaleIds.size}
                    availableStatuses={ALL_STATUSES.filter(
                      (s) => s !== "ANULADO",
                    )}
                    onStatusChange={handleBulkStatusChange}
                    isLoading={isBulkLoading}
                  />
                  <Button
                    variant="outline"
                    className="w-full lg:w-auto"
                    disabled={
                      anuladosAll.filter((s) => selectedSaleIds.has(s.id))
                        .length === 0
                    }
                    onClick={() => handleCopySelected(anuladosAll)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar (
                    {
                      anuladosAll.filter((s) => selectedSaleIds.has(s.id))
                        .length
                    }
                    )
                  </Button>
                  {auth?.user?.role === "ADMIN" && (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() => handleExportExcel(anuladosAll, "anulados")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersAnulados}
                  onFiltersChange={(f) => {
                    setFiltersAnulados(f);
                    setPageAnulados(1);
                  }}
                  showRegionFilter={true}
                />
                {renderTable(anuladosPaginated, true, false)}
              </CardContent>
              <Pagination
                currentPage={pageAnulados}
                totalPages={Math.ceil(anuladosAll.length / ITEMS_PER_PAGE) || 1}
                totalItems={anuladosAll.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPageAnulados}
                itemName="pedidos"
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
          setSelectedSaleForModal(null);
        }}
        onOrderUpdated={fetchOrders}
        hideCallManagement={
          // Mostrar gestión de llamada solo para PREPARADO y LLAMADO (no para EN_ENVIO/ASIGNADO_A_GUIA)
          selectedSaleForModal?.status === "EN_ENVIO" ||
          selectedSaleForModal?.status === "ASIGNADO_A_GUIA" ||
          selectedSaleForModal?.status === "ENTREGADO"
        }
        shippingGuide={selectedShippingGuide}
      />

      {/* Modal de Observaciones */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Observaciones - {selectedSaleForNotes?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Escribe las observaciones aquí..."
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      <CourierAssignmentModal
        open={courierModalOpen}
        onClose={() => setCourierModalOpen(false)}
        selectedCount={getSelectedConGuia().length}
        onConfirm={handleAssignCourier}
        isLoading={isAssigningCourier}
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

      <CreateGuideModal
        open={createGuideModalOpen}
        onClose={() => setCreateGuideModalOpen(false)}
        selectedOrders={getSelectedLlamadosForGuide().map((s) => ({
          id: s.id,
          orderNumber: s.orderNumber,
          clientName: s.clientName,
          address: s.address,
          district: s.district,
          total: s.total,
          pendingPayment: s.pendingPayment,
          zone: s.zone,
        }))}
        storeId={selectedStoreId || ""}
        onConfirm={handleCreateGuide}
        isLoading={isCreatingGuide}
      />

      <AddToExistingGuideModal
        open={addToGuideModalOpen}
        onClose={() => setAddToGuideModalOpen(false)}
        selectedOrders={getSelectedLlamadosForGuide()}
        storeId={selectedStoreId || ""}
        onConfirm={handleAddToExistingGuide}
        isLoading={isAddingToGuide}
      />

      <GuideDetailsModal
        open={guideDetailsModalOpen}
        onClose={() => {
          setGuideDetailsModalOpen(false);
          setSelectedSaleForGuide(null);
        }}
        orderId={selectedSaleForGuide?.id || ""}
        defaultCourier={selectedSaleForGuide?.courier}
        onGuideUpdated={fetchOrders}
      />
    </div>
  );
}
