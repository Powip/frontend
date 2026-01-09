"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, FileText, ArrowRight, ArrowLeft, MessageCircle, StickyNote, AlertTriangle, PackagePlus, Eye } from "lucide-react";

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
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import { SalesTableFilters, SalesFilters, emptySalesFilters, applyFilters } from "@/components/ventas/SalesTableFilters";
import { Copy, Printer, Truck, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CancellationModal, { CancellationReason } from "@/components/modals/CancellationModal";
import CourierAssignmentModal, { CourierType } from "@/components/modals/CourierAssignmentModal";
import { getAvailableStatuses } from "@/utils/domain/orders-status-flow";
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
  hasStockIssue?: boolean;
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
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function OperacionesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Modal de observaciones
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedSaleForNotes, setSelectedSaleForNotes] = useState<Sale | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Filtros avanzados
  const [filtersPreparados, setFiltersPreparados] = useState<SalesFilters>(emptySalesFilters);
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
  const [selectedOrderForGuide, setSelectedOrderForGuide] = useState<string | null>(null);

  const { selectedStoreId } = useAuth();
  const router = useRouter();

  async function fetchOrders() {
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
      );
      setSales(res.data.map(mapOrderToSale));
    } catch (error) {
      console.error("Error fetching orders", error);
    }
  }

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

  // Crear guía de envío
  const handleCreateGuide = async (guideData: CreateGuideData) => {
    setIsCreatingGuide(true);
    try {
      // 1. Crear guía en ms-courier
      const guideResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides`,
        guideData
      );

      // 2. Actualizar estado de cada venta a ASIGNADO_A_GUIA
      let successCount = 0;
      for (const orderId of guideData.orderIds) {
        try {
          await axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
            { status: "ASIGNADO_A_GUIA" }
          );
          successCount++;
        } catch (error) {
          console.error(`Error actualizando orden ${orderId}`, error);
        }
      }

      toast.success(
        `Guía ${guideResponse.data.guideNumber} creada con ${successCount} pedido(s)`
      );
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
  }, [selectedStoreId]);

  const handleDelete = (id: string) => {
    setSales((prev) => prev.filter((sale) => sale.id !== id));
  };

  const handleCopySelected = async (statusFilter: OrderStatus) => {
    const visibleSales = sales.filter((s) => s.status === statusFilter);
    const selectedSales = visibleSales.filter((s) => selectedSaleIds.has(s.id));

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

  // Impresión masiva genérica
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
          const res = await axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}/receipt`
          );
          return { ...res.data, salesRegion: sale.salesRegion, status: sale.status };
        })
      );

      const printContent = receipts.map((receipt, index) => {
        const totalPaid = receipt.payments?.reduce(
          (acc: number, p: any) => acc + Number(p.amount || 0),
          0
        ) || 0;
        const pendingAmount = Math.max(receipt.totals.grandTotal - totalPaid, 0);

        return `
          <div style="page-break-after: ${index < receipts.length - 1 ? 'always' : 'auto'}; padding: 20px; font-family: Arial, sans-serif;">
            <div style="background: ${receipt.salesRegion === 'PROVINCIA' ? '#7c3aed' : '#dc2626'}; color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
              <strong>${receipt.salesRegion} - ${receipt.status}</strong>
            </div>
            
            <h2 style="margin: 0 0 8px 0;">Orden #${receipt.orderNumber}</h2>
            <p style="font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">Total: S/${receipt.totals.grandTotal}</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
              <div><span style="color: #666;">Cliente:</span> ${receipt.customer.fullName}</div>
              <div><span style="color: #666;">Distrito:</span> ${receipt.customer.district || '-'}</div>
              <div><span style="color: #666;">Teléfono:</span> ${receipt.customer.phoneNumber}</div>
              <div><span style="color: #666;">Dirección:</span> ${receipt.customer.address || '-'}</div>
            </div>
            
            <h3 style="margin: 16px 0 8px 0;">Productos</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Producto</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cant.</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Precio</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${receipt.items.map((item: any) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${item.productName}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">S/${item.unitPrice}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">S/${item.subtotal}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-top: 16px; border-top: 2px solid #333; padding-top: 8px;">
              <div style="display: flex; justify-content: space-between;"><span>Total:</span><strong>S/${receipt.totals.grandTotal}</strong></div>
              <div style="display: flex; justify-content: space-between; color: #16a34a;"><span>Adelanto:</span><span>S/${totalPaid.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between; color: #dc2626;"><span>Por Cobrar:</span><span>S/${pendingAmount.toFixed(2)}</span></div>
            </div>
          </div>
        `;
      }).join('');

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Impresión de Recibos</title>
              <style>
                @media print {
                  body { margin: 0; }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }

      toast.success(`${selectedSales.length} recibo(s) enviados a imprimir`);
      setSelectedSaleIds(new Set());
    } catch (error) {
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
    } finally {
      setIsPrinting(false);
    }
  };

  const renderTable = (data: Sale[], showWhatsApp: boolean = false) => (
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
          <TableHead>Guía</TableHead>
          <TableHead>Region</TableHead>
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
            <TableCell>
              {sale.status === ORDER_STATUS.ASIGNADO_A_GUIA ? (
                <Badge 
                  className="bg-green-100 text-green-800 cursor-pointer hover:bg-green-200"
                  onClick={() => {
                    setSelectedOrderForGuide(sale.id);
                    setGuideDetailsModalOpen(true);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Ver guía
                </Badge>
              ) : sale.status === ORDER_STATUS.LLAMADO ? (
                <Badge className="bg-amber-100 text-amber-800">
                  Sin guía
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{sale.salesRegion}</TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedOrderId(sale.id);
                  setReceiptOpen(true);
                }}
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
                onClick={() => {
                  setSelectedSaleForComments(sale);
                  setCommentsModalOpen(true);
                }}
                title="Comentarios"
              >
                <MessageSquare className="h-4 w-4" />
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

  // Preparados: Lima y Provincia
  const preparados = useMemo(
    () => {
      const statusFiltered = sales.filter(
        (s) => s.status === ORDER_STATUS.PREPARADO
      );
      return applyFilters(statusFiltered, filtersPreparados);
    },
    [sales, filtersPreparados]
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
            <TabsTrigger value="contactados">
              Contactados ({contactados.length})
            </TabsTrigger>
            <TabsTrigger value="despachados">
              Despachados ({despachados.length})
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
                    onClick={() => handleCopySelected("PREPARADO")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({preparados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersPreparados}
                  onFiltersChange={setFiltersPreparados}
                  showRegionFilter={true}
                />
                {renderTable(preparados, true)}
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
                    onClick={() => handleCopySelected("LLAMADO")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({contactados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersContactados}
                  onFiltersChange={setFiltersContactados}
                />
                {renderTable(contactados, false)}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Despachados (En Envío)</CardTitle>
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
                    onClick={() => handleCopySelected("EN_ENVIO")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({despachados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersDespachados}
                  onFiltersChange={setFiltersDespachados}
                  showCourierFilter={true}
                  availableCouriers={availableCouriers}
                />
                {renderTable(despachados, false)}
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
        </Tabs>
      </main>

      <OrderReceiptModal
        open={receiptOpen}
        orderId={selectedOrderId || ""}
        onClose={() => setReceiptOpen(false)}
        onStatusChange={fetchOrders}
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
        }))}
        storeId={selectedStoreId || ""}
        onConfirm={handleCreateGuide}
        isLoading={isCreatingGuide}
      />

      <GuideDetailsModal
        open={guideDetailsModalOpen}
        onClose={() => {
          setGuideDetailsModalOpen(false);
          setSelectedOrderForGuide(null);
        }}
        orderId={selectedOrderForGuide || ""}
        onGuideUpdated={fetchOrders}
      />
    </div>
  );
}
