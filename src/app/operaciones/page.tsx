"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Pencil, Trash2, FileText, ArrowRight, ArrowLeft, MessageCircle, StickyNote, AlertTriangle, PackagePlus, Eye, Download } from "lucide-react";

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
import CustomerServiceModal, { ShippingGuideData } from "@/components/modals/CustomerServiceModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import { SalesTableFilters, SalesFilters, emptySalesFilters, applyFilters } from "@/components/ventas/SalesTableFilters";
import { Copy, Printer, Truck, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CancellationModal, { CancellationReason } from "@/components/modals/CancellationModal";
import CourierAssignmentModal, { CourierType } from "@/components/modals/CourierAssignmentModal";
import { getAvailableStatuses } from "@/utils/domain/orders-status-flow";
import { printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";
import CommentsTimelineModal from "@/components/modals/CommentsTimelineModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import CreateGuideModal, { CreateGuideData } from "@/components/modals/CreateGuideModal";
import GuideDetailsModal from "@/components/modals/GuideDetailsModal";
import { Badge } from "@/components/ui/badge";

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
  date: string;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  deliveryType: string;
  salesRegion: "LIMA" | "PROVINCIA";
  district: string;
  address: string;
  advancePayment: number;
  pendingPayment: number;
  notes: string;
  courier?: string | null;
  guideNumber?: string | null;
  hasStockIssue?: boolean;
  zone?: string;
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | null;
}

/* -----------------------------------------
   Mapper
----------------------------------------- */

function mapOrderToSale(order: OrderHeader): Sale {
  const total = Number(order.grandTotal);
  const advancePayment = order.payments.reduce(
    (acc, p) => acc + Number(p.amount || 0),
    0
  );
  const pendingPayment = Math.max(total - advancePayment, 0);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.customer.fullName,
    phoneNumber: order.customer.phoneNumber ?? "999",
    date: new Date(order.created_at).toLocaleDateString("es-AR"),
    total,
    courier: order.courier ?? null,
    status: order.status,
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
    salesRegion: order.salesRegion,
    district: order.customer.district ?? "",
    address: order.customer.address ?? "",
    advancePayment,
    pendingPayment,
    notes: order.notes ?? "",
    hasStockIssue: order.hasStockIssue ?? false,
    zone: order.customer.zone ?? undefined,
    guideNumber: order.guideNumber ?? null,
    callStatus: order.callStatus,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function OperacionesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<Sale | null>(null);
  const [selectedShippingGuide, setSelectedShippingGuide] = useState<ShippingGuideData | null>(null);

  // Modal de observaciones
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedSaleForNotes, setSelectedSaleForNotes] = useState<Sale | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Filtros avanzados
  const [filtersPreparados, setFiltersPreparados] = useState<SalesFilters>(emptySalesFilters);
  const [filtersNoConfirmados, setFiltersNoConfirmados] = useState<SalesFilters>(emptySalesFilters);
  const [filtersConfirmados, setFiltersConfirmados] = useState<SalesFilters>(emptySalesFilters);
  const [filtersContactados, setFiltersContactados] = useState<SalesFilters>(emptySalesFilters);
  const [filtersDespachados, setFiltersDespachados] = useState<SalesFilters>(emptySalesFilters);
  const [isPrinting, setIsPrinting] = useState(false);

  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(
    new Set()
  );

  // Estado para modal de cancelación
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Estado para modal de asignación de courier
  const [courierModalOpen, setCourierModalOpen] = useState(false);
  const [isAssigningCourier, setIsAssigningCourier] = useState(false);

  // Estado para modal de comentarios/timeline
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedSaleForComments, setSelectedSaleForComments] = useState<Sale | null>(null);

  // Estado para modal de pagos
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);

  // Estado para modal de crear guía
  const [createGuideModalOpen, setCreateGuideModalOpen] = useState(false);
  const [isCreatingGuide, setIsCreatingGuide] = useState(false);

  // Estado para modal de ver guía
  const [guideDetailsModalOpen, setGuideDetailsModalOpen] = useState(false);
  const [selectedSaleForGuide, setSelectedSaleForGuide] = useState<Sale | null>(null);

  const { auth, selectedStoreId } = useAuth();
  const router = useRouter();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
      );
      
      const mappedSales = res.data.map(mapOrderToSale);
      
      // Enriquecer órdenes con guideNumber que no tienen courier con el courierName de la guía
      const ordersNeedingCourier = mappedSales.filter(
        (sale) => sale.guideNumber && !sale.courier
      );
      
      if (ordersNeedingCourier.length > 0) {
        // Buscar courierName para cada orden que lo necesite
        const enrichedSales = await Promise.all(
          mappedSales.map(async (sale) => {
            if (sale.guideNumber && !sale.courier) {
              try {
                const guideRes = await axios.get(
                  `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${sale.id}`
                );
                if (guideRes.data?.courierName) {
                  return { ...sale, courier: guideRes.data.courierName };
                }
              } catch {
                // Si falla, mantener la venta sin cambios
              }
            }
            return sale;
          })
        );
        setSales(enrichedSales);
      } else {
        setSales(mappedSales);
      }
    } catch (error) {
      console.error("Error fetching orders", error);
    }
  }, [selectedStoreId]);

  const handleChangeStatus = async (saleId: string, newStatus: OrderStatus, cancellationReason?: CancellationReason) => {
    // Si el nuevo estado es ANULADO y no hay motivo, abrir modal
    if (newStatus === "ANULADO" && !cancellationReason) {
      const sale = sales.find((s) => s.id === saleId);
      if (sale) {
        setSaleToCancel(sale);
        setCancellationModalOpen(true);
      }
      return;
    }

    // Validar courier antes de cambiar a EN_ENVIO
    if (newStatus === "EN_ENVIO") {
      const sale = sales.find((s) => s.id === saleId);
      if (sale && !sale.courier) {
        toast.error("Debe asignar un courier antes de cambiar a EN_ENVIO");
        return;
      }
    }

    try {
      const payload: { status: OrderStatus; cancellationReason?: string } = { status: newStatus };
      if (cancellationReason) {
        payload.cancellationReason = cancellationReason;
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleId}`,
        payload
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

  const handleConfirmCancellation = async (reason: CancellationReason, notes?: string) => {
    if (!saleToCancel) return;

    setIsCancelling(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleToCancel.id}`,
        {
          status: "ANULADO",
          cancellationReason: reason,
          notes: notes,
        }
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
      (s) => selectedSaleIds.has(s.id) && s.status === ORDER_STATUS.ASIGNADO_A_GUIA
    );
  };

  const handleAssignCourier = async (courier: string) => {
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
            }
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
      setSelectedSaleIds(new Set());
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
      (s) => selectedSaleIds.has(s.id) &&
        s.status === ORDER_STATUS.LLAMADO &&
        s.deliveryType.toUpperCase() === "DOMICILIO"
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
          guideData
        );

        const guideNumber = guideResponse.data.guideNumber;
        createdGuides.push(guideNumber);
        totalOrders += guideData.orderIds.length;

        // Actualizar cada orden con el guideNumber y cambiar estado a ASIGNADO_A_GUIA
        for (const orderId of guideData.orderIds) {
          await axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
            {
              guideNumber: guideNumber,
              status: "ASIGNADO_A_GUIA",
            }
          );
        }
      }

      if (createdGuides.length === 1) {
        toast.success(
          `Guía ${createdGuides[0]} creada con ${totalOrders} pedido(s)`
        );
      } else {
        toast.success(
          `${createdGuides.length} guías creadas (${createdGuides.join(", ")}) con ${totalOrders} pedido(s)`
        );
      }

      setCreateGuideModalOpen(false);
      setSelectedSaleIds(new Set());
      fetchOrders();
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
        { notes: notesText }
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

  const handleWhatsApp = (phoneNumber: string, orderNumber?: string, clientName?: string) => {
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

    // Construir mensaje si tenemos datos de la orden
    let url = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
    if (orderNumber && clientName) {
      const message = `Hola ${clientName}, acá tenés el resumen de tu compra N° ${orderNumber}`;
      url += `&text=${encodeURIComponent(message)}`;
    }

    window.open(url, "_blank");
  };

  const toggleSale = (id: string) => {
    setSelectedSaleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${sale.id}`
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
`.trim()
      )
      .join("\n\n--------------------\n\n");

    await navigator.clipboard.writeText(text);
    toast.success(`${selectedSales.length} pedido(s) copiados`);
  };

  // Exportar a Excel (CSV)
  const handleExportExcel = (salesList: Sale[], tabName: string) => {
    if (salesList.length === 0) {
      toast.warning("No hay datos para exportar");
      return;
    }

    const exportData = salesList.map((s, index) => ({
      "N°": index + 1,
      "Orden": s.orderNumber,
      "Cliente": s.clientName,
      "Teléfono": s.phoneNumber,
      "Fecha": s.date,
      "Total": s.total.toFixed(2),
      "Adelanto": s.advancePayment.toFixed(2),
      "Por Cobrar": s.pendingPayment.toFixed(2),
      "Estado": s.status,
      "Región": s.salesRegion,
      "Zona": s.zone || "-",
      "Distrito": s.district,
      "Dirección": s.address,
      "Courier": s.courier || "-",
      "Guía": s.guideNumber || "-",
      "Método Pago": s.paymentMethod,
      "Tipo Entrega": s.deliveryType,
    }));

    const headers = Object.keys(exportData[0] || {}).join(",");
    const rows = exportData.map((row) =>
      Object.values(row)
        .map((val) => `"${val}"`)
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `operaciones_${tabName}_${today}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

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
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}/receipt`
          );
          return res.data;
        })
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

  const renderTable = (data: Sale[], showWhatsApp: boolean = false, showGuideColumn: boolean = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <input
              type="checkbox"
              checked={data.length > 0 && data.every((s) => selectedSaleIds.has(s.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedSaleIds((prev) => new Set([...prev, ...data.map((s) => s.id)]));
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
          <TableHead>N° Orden</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Pago</TableHead>
          <TableHead>Envío</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Adelanto</TableHead>
          <TableHead>Por Cobrar</TableHead>
          <TableHead>Estado</TableHead>
          {showGuideColumn && <TableHead>Guía</TableHead>}
          {showGuideColumn && <TableHead>Courier</TableHead>}
          <TableHead>Region</TableHead>
          <TableHead>Distrito</TableHead>
          <TableHead>Zona</TableHead>
          <TableHead>Resumen</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell>
              <input
                type="checkbox"
                checked={selectedSaleIds.has(sale.id)}
                onChange={() => toggleSale(sale.id)}
              />
            </TableCell>
            <TableCell className="font-medium">
              <div className="flex items-center gap-1">
                {sale.hasStockIssue && (
                  <span title="Stock insuficiente - No se puede preparar">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </span>
                )}
                {sale.orderNumber}
              </div>
            </TableCell>
            <TableCell>{sale.clientName}</TableCell>
            <TableCell>{sale.phoneNumber}</TableCell>
            <TableCell>{sale.date}</TableCell>
            <TableCell>{sale.paymentMethod}</TableCell>
            <TableCell>{sale.deliveryType}</TableCell>
            <TableCell>${sale.total.toFixed(2)}</TableCell>
            <TableCell className="text-green-600">${sale.advancePayment.toFixed(2)}</TableCell>
            <TableCell className="text-red-600">${sale.pendingPayment.toFixed(2)}</TableCell>
            <TableCell>
              <select
                value={sale.status}
                onChange={(e) => handleChangeStatus(sale.id, e.target.value as OrderStatus)}
                className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
              >
                {getAvailableStatuses(sale.status, sale.salesRegion).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
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
                  className={`text-xs whitespace-nowrap ${sale.zone === 'LIMA_NORTE' ? 'bg-blue-100 text-blue-800' :
                    sale.zone === 'CALLAO' ? 'bg-yellow-100 text-yellow-800' :
                      sale.zone === 'LIMA_CENTRO' ? 'bg-green-100 text-green-800' :
                        sale.zone === 'LIMA_SUR' ? 'bg-purple-100 text-purple-800' :
                          sale.zone === 'LIMA_ESTE' ? 'bg-orange-100 text-orange-800' :
                            sale.zone === 'ZONAS_ALEDANAS' ? 'bg-gray-100 text-gray-800' :
                              sale.zone === 'PROVINCIAS' ? 'bg-red-100 text-red-800' :
                                'bg-muted text-muted-foreground'
                    }`}
                >
                  {sale.zone === 'LIMA_NORTE' ? '🟦 L. Norte' :
                    sale.zone === 'CALLAO' ? '🟨 Callao' :
                      sale.zone === 'LIMA_CENTRO' ? '🟩 L. Centro' :
                        sale.zone === 'LIMA_SUR' ? '🟪 L. Sur' :
                          sale.zone === 'LIMA_ESTE' ? '🟧 L. Este' :
                            sale.zone === 'ZONAS_ALEDANAS' ? '⛰️ Aledañas' :
                              sale.zone === 'PROVINCIAS' ? '🧭 Provincias' :
                                sale.zone}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">-</span>
              )}
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenReceipt(sale)}
              >
                <FileText className="h-4 w-4 mr-1" />
                Ver
              </Button>
            </TableCell>
            <TableCell className="text-right space-x-1">
              {/* WhatsApp */}
              {showWhatsApp && (
                <Button
                  size="icon"
                  variant="outline"
                  className="bg-green-500 hover:bg-green-600 text-white"
                  title="Contactar por WhatsApp"
                  onClick={() => handleWhatsApp(sale.phoneNumber, sale.orderNumber, sale.clientName)}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="outline"
                className="bg-amber-50 hover:bg-amber-100 text-amber-600"
                onClick={() => {
                  setSelectedSaleForPayment(sale);
                  setPaymentModalOpen(true);
                }}
                title="Gestión de Pagos"
              >
                <DollarSign className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => router.push(`/registrar-venta?orderId=${sale.id}`)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && (
          <TableRow>
            <TableCell colSpan={15} className="text-center text-muted-foreground py-6">
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

  // Preparados: Lima y Provincia (sin llamar o pendiente de llamada)
  const preparados = useMemo(
    () => {
      const statusFiltered = sales.filter(
        (s) => s.status === ORDER_STATUS.PREPARADO &&
          (!s.callStatus || s.callStatus === "PENDING")
      );
      return applyFilters(statusFiltered, filtersPreparados);
    },
    [sales, filtersPreparados]
  );

  // No Confirmados: status = PREPARADO y callStatus = NO_ANSWER
  const noConfirmados = useMemo(
    () => {
      const statusFiltered = sales.filter(
        (s) => s.status === ORDER_STATUS.PREPARADO &&
          s.callStatus === "NO_ANSWER"
      );
      return applyFilters(statusFiltered, filtersNoConfirmados);
    },
    [sales, filtersNoConfirmados]
  );

  // Confirmados: status = LLAMADO (ya confirmaron)
  const confirmados = useMemo(
    () => {
      const statusFiltered = sales.filter((s) => s.status === ORDER_STATUS.LLAMADO);
      return applyFilters(statusFiltered, filtersConfirmados);
    },
    [sales, filtersConfirmados]
  );

  const contactados = useMemo(
    () => {
      const statusFiltered = sales.filter(
        (s) => s.status === ORDER_STATUS.LLAMADO || s.status === ORDER_STATUS.ASIGNADO_A_GUIA
      );
      return applyFilters(statusFiltered, filtersContactados);
    },
    [sales, filtersContactados]
  );

  const despachados = useMemo(
    () => {
      const statusFiltered = sales.filter(
        (s) => s.status === ORDER_STATUS.EN_ENVIO
      );
      return applyFilters(statusFiltered, filtersDespachados);
    },
    [sales, filtersDespachados]
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

        <div className="flex justify-between mb-4">
          <Link href="/ventas">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Ventas
            </Button>
          </Link>
          <Link href="/finanzas">
            <Button variant="outline">
              Ir a Finanzas
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Tabs para Operaciones */}
        <Tabs defaultValue="preparados" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="preparados">
              Preparados ({preparados.length})
            </TabsTrigger>
            <TabsTrigger value="no_confirmados" className="text-red-600">
              No Confirmados ({noConfirmados.length})
            </TabsTrigger>
            <TabsTrigger value="confirmados" className="text-green-600">
              Confirmados ({confirmados.length})
            </TabsTrigger>
            <TabsTrigger value="contactados">
              Contactados ({contactados.length})
            </TabsTrigger>
            <TabsTrigger value="despachados">
              En Envío ({despachados.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Preparados */}
          <TabsContent value="preparados">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Preparados</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={preparados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(preparados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({preparados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={preparados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected(preparados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({preparados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportExcel(preparados, "preparados")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
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
                onPageChange={() => { }}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab No Confirmados */}
          <TabsContent value="no_confirmados">
            <Card className="border-red-200">
              <CardHeader className="flex flex-row items-center justify-between bg-red-50">
                <CardTitle className="text-red-700">Pedidos NO CONFIRMADOS</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={noConfirmados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(noConfirmados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({noConfirmados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={noConfirmados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected(noConfirmados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({noConfirmados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportExcel(noConfirmados, "no_confirmados")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
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
                onPageChange={() => { }}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Confirmados */}
          <TabsContent value="confirmados">
            <Card className="border-green-200">
              <CardHeader className="flex flex-row items-center justify-between bg-green-50">
                <CardTitle className="text-green-700">Pedidos CONFIRMADOS</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={confirmados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isCreatingGuide}
                    onClick={() => setCreateGuideModalOpen(true)}
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Generar Guía ({confirmados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={confirmados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(confirmados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({confirmados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={confirmados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected(confirmados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({confirmados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportExcel(confirmados, "confirmados")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersConfirmados}
                  onFiltersChange={setFiltersConfirmados}
                  showRegionFilter={true}
                  showZoneFilter={true}
                />
                {renderTable(confirmados, false, false)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(confirmados.length / 10) || 1}
                totalItems={confirmados.length}
                itemsPerPage={10}
                onPageChange={() => { }}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Contactados */}
          <TabsContent value="contactados">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Contactados</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={getSelectedLlamadosForGuide().length === 0 || isCreatingGuide}
                    onClick={() => setCreateGuideModalOpen(true)}
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Generar Guía ({getSelectedLlamadosForGuide().length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={contactados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(contactados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({contactados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={contactados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected(contactados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({contactados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportExcel(contactados, "contactados")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
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
                {renderTable(contactados, false, true)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(contactados.length / 10) || 1}
                totalItems={contactados.length}
                itemsPerPage={10}
                onPageChange={() => { }}
                itemName="pedidos"
              />
            </Card>
          </TabsContent>

          {/* Tab Despachados */}
          <TabsContent value="despachados">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos En Envío</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={despachados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(despachados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({despachados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={despachados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected(despachados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({despachados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportExcel(despachados, "despachados")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
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
                {renderTable(despachados, false, true)}
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(despachados.length / 10) || 1}
                totalItems={despachados.length}
                itemsPerPage={10}
                onPageChange={() => { }}
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
