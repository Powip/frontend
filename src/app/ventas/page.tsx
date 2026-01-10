"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, FileText, ArrowRight, Printer, AlertTriangle } from "lucide-react";

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
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import { SalesTableFilters, SalesFilters, emptySalesFilters, applyFilters } from "@/components/ventas/SalesTableFilters";
import { Copy, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CancellationModal, { CancellationReason } from "@/components/modals/CancellationModal";
import { getAvailableStatuses } from "@/utils/domain/orders-status-flow";
import CommentsTimelineModal from "@/components/modals/CommentsTimelineModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";

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
    status: order.status,
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
    salesRegion: order.salesRegion,
    district: order.customer.district ?? "",
    address: order.customer.address ?? "",
    advancePayment,
    pendingPayment,
    hasStockIssue: order.hasStockIssue ?? false,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Filtros avanzados
  const [filtersPendiente, setFiltersPendiente] = useState<SalesFilters>(emptySalesFilters);
  const [filtersAnulado, setFiltersAnulado] = useState<SalesFilters>(emptySalesFilters);

  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(
    new Set()
  );

  // Estado para modal de cancelación
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Estado para modal de comentarios
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedSaleForComments, setSelectedSaleForComments] = useState<Sale | null>(null);

  // Estado para modal de pagos
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);

  const { auth,selectedStoreId } = useAuth();
  const router = useRouter();


  useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth]);
    

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get<OrderHeader[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
      );
      setSales(res.data.map(mapOrderToSale));
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
    } catch (error) {
      console.error("Error actualizando estado", error);
      toast.error("No se pudo actualizar el estado");
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
      next.has(id) ? next.delete(id) : next.add(id);
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
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}`
      );
      toast.success("Venta eliminada");
      fetchOrders();
    } catch (error) {
      console.error("Error eliminando venta", error);
      toast.error("No se pudo eliminar la venta");
    }
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

  // Impresión masiva: obtiene recibos, imprime cada uno en página separada, luego cambia estado
  const handleBulkPrint = async () => {
    const selectedPendientes = pendientes.filter((s) => selectedSaleIds.has(s.id));
    
    if (selectedPendientes.length === 0) {
      toast.warning("No hay pedidos seleccionados para imprimir");
      return;
    }

    setIsPrinting(true);
    toast.info(`Preparando ${selectedPendientes.length} recibo(s) para imprimir...`);

    try {
      // Obtener recibos de todas las ventas seleccionadas
      const receipts = await Promise.all(
        selectedPendientes.map(async (sale) => {
          const res = await axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}/receipt`
          );
          return { ...res.data, salesRegion: sale.salesRegion };
        })
      );

      // Generar HTML para impresión con page-break
      const printContent = receipts.map((receipt, index) => {
        const totalPaid = receipt.payments?.reduce(
          (acc: number, p: any) => acc + Number(p.amount || 0),
          0
        ) || 0;
        const pendingAmount = Math.max(receipt.totals.grandTotal - totalPaid, 0);
        const newStatus = "PREPARADO"; // Flujo unificado para LIMA y PROVINCIA

        return `
          <div style="page-break-after: ${index < receipts.length - 1 ? 'always' : 'auto'}; padding: 20px; font-family: Arial, sans-serif;">
            <div style="background: ${receipt.salesRegion === 'PROVINCIA' ? '#7c3aed' : '#dc2626'}; color: white; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
              <strong>${receipt.salesRegion === 'PROVINCIA' ? 'PROVINCIA → ' + newStatus : 'LIMA → ' + newStatus}</strong>
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

      // Abrir ventana de impresión
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

      // Después de imprimir, cambiar estados
      let successCount = 0;
      let errorCount = 0;

      for (const sale of selectedPendientes) {
        const newStatus = "PREPARADO"; // Flujo unificado para LIMA y PROVINCIA
        try {
          await axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${sale.id}`,
            { status: newStatus }
          );
          successCount++;
        } catch (error) {
          console.error(`Error actualizando ${sale.orderNumber}`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} pedido(s) impresos y actualizados`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} pedido(s) no pudieron ser actualizados`);
      }
      
      fetchOrders();
      setSelectedSaleIds(new Set());
    } catch (error) {
      console.error("Error en impresión masiva", error);
      toast.error("Error al preparar los recibos para imprimir");
    } finally {
      setIsPrinting(false);
    }
  };

  // Impresión masiva genérica (sin cambiar estado)
  const handleBulkPrintForStatus = async (salesList: Sale[], statusLabel: string) => {
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

  // Tabla para Pendientes (sin delete)
  const renderPendientesTable = (data: Sale[]) => (
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
            <TableCell className="text-right">
              <div className="flex gap-1 justify-end">
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
              </div>
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && (
          <TableRow>
            <TableCell colSpan={14} className="text-center text-muted-foreground py-6">
              No hay ventas en este estado
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  // Tabla para Anulados (con delete)
  const renderAnuladosTable = (data: Sale[]) => (
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
            <TableCell className="font-medium">{sale.orderNumber}</TableCell>
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
            <TableCell className="text-right space-x-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setSelectedSaleForComments(sale);
                  setCommentsModalOpen(true);
                }}
                title="Ver comentarios / razón de anulación"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => router.push(`/registrar-venta?orderId=${sale.id}`)}
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
            </TableCell>
          </TableRow>
        ))}
        {data.length === 0 && (
          <TableRow>
            <TableCell colSpan={14} className="text-center text-muted-foreground py-6">
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

  const pendientes = useMemo(
    () => {
      const statusFiltered = sales.filter((s) => s.status === ORDER_STATUS.PENDIENTE);
      return applyFilters(statusFiltered, filtersPendiente);
    },
    [sales, filtersPendiente]
  );

  const anulados = useMemo(
    () => {
      const statusFiltered = sales.filter((s) => s.status === ORDER_STATUS.ANULADO);
      return applyFilters(statusFiltered, filtersAnulado);
    },
    [sales, filtersAnulado]
  );

  const selectedPendientesCount = pendientes.filter((s) => selectedSaleIds.has(s.id)).length;

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

        <div className="flex justify-end gap-2 mb-4">
          <Link href="/operaciones">
            <Button variant="outline">
              Ir a Operaciones
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/registrar-venta">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva venta
            </Button>
          </Link>
        </div>

        {/* Tabs para Ventas */}
        <Tabs defaultValue="pendientes" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pendientes">
              Ventas Pendientes ({pendientes.length})
            </TabsTrigger>
            <TabsTrigger value="anuladas">
              Ventas Anuladas ({anulados.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Pendientes */}
          <TabsContent value="pendientes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ventas Pendientes</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={selectedPendientesCount === 0 || isPrinting}
                    onClick={handleBulkPrint}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    {isPrinting ? "Procesando..." : `Imprimir seleccionados (${selectedPendientesCount})`}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedPendientesCount === 0}
                    onClick={() => handleCopySelected("PENDIENTE")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({selectedPendientesCount})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersPendiente}
                  onFiltersChange={setFiltersPendiente}
                />
                {renderPendientesTable(pendientes)}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ventas Anuladas</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={anulados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(anulados, "ANULADO")}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({anulados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={anulados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected("ANULADO")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({anulados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersAnulado}
                  onFiltersChange={setFiltersAnulado}
                />
                {renderAnuladosTable(anulados)}
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
        </Tabs>
      </main>

      <OrderReceiptModal
        open={receiptOpen}
        orderId={selectedOrderId || ""}
        onClose={() => setReceiptOpen(false)}
        onStatusChange={fetchOrders}
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
    </div>
  );
}
