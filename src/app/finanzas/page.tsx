"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, FileText, ArrowLeft } from "lucide-react";

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

import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import { SalesTableFilters, SalesFilters, emptySalesFilters, applyFilters } from "@/components/ventas/SalesTableFilters";
import { Copy, Printer, MessageSquare, DollarSign } from "lucide-react";
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
  courier: string | null;
  // Nuevos campos para pagos
  hasPendingPayments: boolean;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
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
  
  // Calcular pagos pendientes de aprobación
  const pendingPayments = order.payments.filter((p) => p.status === "PENDING");
  const pendingPaymentsAmount = pendingPayments.reduce(
    (acc, p) => acc + Number(p.amount || 0),
    0
  );

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
    courier: order.courier ?? null,
    hasPendingPayments: pendingPayments.length > 0,
    pendingPaymentsCount: pendingPayments.length,
    pendingPaymentsAmount,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function FinanzasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Filtros avanzados
  const [filtersPagosPendientes, setFiltersPagosPendientes] = useState<SalesFilters>(emptySalesFilters);
  const [filtersEntregado, setFiltersEntregado] = useState<SalesFilters>(emptySalesFilters);
  const [isPrinting, setIsPrinting] = useState(false);

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
  }, [selectedStoreId]);

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

  // Tabla para Despachados (con select de estado)
  const renderDespachadosTable = (data: Sale[]) => (
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
          <TableHead>Enviado Por</TableHead>
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
            <TableCell>{sale.courier || "—"}</TableCell>
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
            <TableCell colSpan={15} className="text-center text-muted-foreground py-6">
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
          <TableHead>Enviado Por</TableHead>
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
            <TableCell>{sale.courier || "—"}</TableCell>
            <TableCell>
              <Badge variant="default" className="bg-green-600">ENTREGADO</Badge>
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

  // Ventas con pagos pendientes de aprobación
  const pagosPendientes = useMemo(
    () => {
      const filtered = sales.filter((s) => s.hasPendingPayments);
      return applyFilters(filtered, filtersPagosPendientes);
    },
    [sales, filtersPagosPendientes]
  );

  const entregados = useMemo(
    () => {
      const statusFiltered = sales.filter((s) => s.status === ORDER_STATUS.ENTREGADO);
      return applyFilters(statusFiltered, filtersEntregado);
    },
    [sales, filtersEntregado]
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
            title="Finanzas"
            description="Gestión de pagos pendientes y ventas entregadas"
          />
        </div>

        <div className="flex justify-start mb-4">
          <Link href="/operaciones">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Operaciones
            </Button>
          </Link>
        </div>

        {/* Tabs para Finanzas */}
        <Tabs defaultValue="pagosPendientes" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pagosPendientes">
              Pagos Pendientes ({pagosPendientes.length})
            </TabsTrigger>
            <TabsTrigger value="entregados">
              Entregados ({entregados.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Pagos Pendientes */}
          <TabsContent value="pagosPendientes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pagos Pendientes de Aprobación</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ventas con comprobantes de pago por verificar
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <SalesTableFilters
                  filters={filtersPagosPendientes}
                  onFiltersChange={setFiltersPagosPendientes}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado Venta</TableHead>
                      <TableHead>Total Venta</TableHead>
                      <TableHead>Pagos Pendientes</TableHead>
                      <TableHead>Monto por Aprobar</TableHead>
                      <TableHead>Resumen</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosPendientes.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.orderNumber}</TableCell>
                        <TableCell>{sale.clientName}</TableCell>
                        <TableCell>{sale.phoneNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.status}</Badge>
                        </TableCell>
                        <TableCell>S/{sale.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className="bg-amber-100 text-amber-800">
                            {sale.pendingPaymentsCount} pago(s)
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-amber-600">
                          S/{sale.pendingPaymentsAmount.toFixed(2)}
                        </TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagosPendientes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                          No hay pagos pendientes de aprobación
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <Pagination
                currentPage={1}
                totalPages={Math.ceil(pagosPendientes.length / 10) || 1}
                totalItems={pagosPendientes.length}
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
                    disabled={entregados.filter((s) => selectedSaleIds.has(s.id)).length === 0 || isPrinting}
                    onClick={() => handleBulkPrintForStatus(entregados)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir seleccionados ({entregados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
                  <Button
                    variant="outline"
                    disabled={entregados.filter((s) => selectedSaleIds.has(s.id)).length === 0}
                    onClick={() => handleCopySelected("ENTREGADO")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({entregados.filter((s) => selectedSaleIds.has(s.id)).length})
                  </Button>
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
        canApprove={true}
      />
    </div>
  );
}
