"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, FileText, ArrowLeft, MessageSquare, DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HeaderConfig } from "@/components/header/HeaderConfig"; 
import axios from "axios";
import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { toast } from "sonner";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
import { Copy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CommentsTimelineModal from "@/components/modals/CommentsTimelineModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import { useRouter } from "next/navigation";
import CustomerServiceModal from "@/components/modals/CustomerServiceModal"; 
import { useAuth } from "@/contexts/AuthContext";

/* -----------------------------------------
   Types
----------------------------------------- */

interface Sale {
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
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | null;
}

/* -----------------------------------------
   Mapper
----------------------------------------- */

function mapOrderToSale(order: OrderHeader): Sale {
  const totalPaid = order.payments
    ?.filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  
  const grandTotal = Number(order.grandTotal);
  
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.customer?.fullName ?? "-",
    phoneNumber: order.customer?.phoneNumber ?? "-",
    date: new Date(order.created_at).toLocaleDateString("es-PE"),
    total: grandTotal,
    status: order.status,
    paymentMethod: order.payments?.[0]?.paymentMethod ?? "-",
    deliveryType: order.deliveryType,
    salesRegion: order.salesRegion,
    district: order.customer?.district ?? "-",
    address: order.customer?.address ?? "-",
    advancePayment: totalPaid,
    pendingPayment: Math.max(grandTotal - totalPaid, 0),
    callStatus: order.callStatus,
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function AtencionClientePage() {
  const { auth, selectedStoreId } = useAuth();
  const router = useRouter();
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedSaleForComments, setSelectedSaleForComments] = useState<Sale | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);
  const [customerServiceModalOpen, setCustomerServiceModalOpen] = useState(false);
  const [selectedSaleForService, setSelectedSaleForService] = useState<Sale | null>(null);
  
  // Selection
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);

  const fetchOrders = async () => {
    if (!selectedStoreId) return;
    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
      );
      const mapped = res.data.map(mapOrderToSale);
      setSales(mapped);
    } catch (error) {
      console.error("Error fetching orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedStoreId) return;
    fetchOrders();
  }, [selectedStoreId]);

  const handleWhatsApp = (phoneNumber: string, orderNumber?: string, clientName?: string) => {
    const phone = phoneNumber.replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;
    
    let message = `Hola${clientName ? ` ${clientName}` : ""}! `;
    if (orderNumber) {
      message += `Te contactamos por tu pedido ${orderNumber}.`;
    }
    
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const toggleSale = (id: string) => {
    setSelectedSaleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCopySelected = async (salesList: Sale[]) => {
    const selectedSales = salesList.filter((s) => selectedSaleIds.has(s.id));
    
    if (selectedSales.length === 0) {
      toast.warning("No hay pedidos seleccionados");
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
Total Venta: S/${sale.total.toFixed(2)}
Adelanto: S/${sale.advancePayment.toFixed(2)}
Por Cobrar: S/${sale.pendingPayment.toFixed(2)}
Estado: ${sale.status}
`.trim()
      )
      .join("\n\n--------------------\n\n");

    await navigator.clipboard.writeText(text);
    toast.success(`${selectedSales.length} pedido(s) copiados`);
  };

  /* -----------------------------------------
     Render Table
  ----------------------------------------- */
  
  const renderTable = (data: Sale[], tableType: "preparados" | "no_confirmados" | "confirmados") => (
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
            <TableCell>S/{sale.total.toFixed(2)}</TableCell>
            <TableCell className="text-green-600">S/{sale.advancePayment.toFixed(2)}</TableCell>
            <TableCell className="text-red-600">S/{sale.pendingPayment.toFixed(2)}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                sale.status === "PREPARADO" ? "bg-yellow-100 text-yellow-800" :
                sale.status === "LLAMADO" ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {sale.status}
              </span>
            </TableCell>
            <TableCell>{sale.salesRegion}</TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedSaleForService(sale);
                  setCustomerServiceModalOpen(true);
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
              No hay ventas en esta categoría
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  /* -----------------------------------------
     Filters
  ----------------------------------------- */

  // Pedidos Preparados: status = PREPARADO y (callStatus null o PENDING)
  const pedidosPreparados = useMemo(
    () => sales.filter((s) => 
      s.status === "PREPARADO" && 
      (!s.callStatus || s.callStatus === "PENDING")
    ),
    [sales]
  );

  // Pedidos No Confirmados: status = PREPARADO y callStatus = NO_ANSWER
  const pedidosNoConfirmados = useMemo(
    () => sales.filter((s) => 
      s.status === "PREPARADO" && 
      s.callStatus === "NO_ANSWER"
    ),
    [sales]
  );

  // Pedidos Confirmados: status = LLAMADO
  const pedidosConfirmados = useMemo(
    () => sales.filter((s) => s.status === "LLAMADO"),
    [sales]
  );

  const selectedPreparadosCount = pedidosPreparados.filter((s) => selectedSaleIds.has(s.id)).length;
  const selectedNoConfirmadosCount = pedidosNoConfirmados.filter((s) => selectedSaleIds.has(s.id)).length;
  const selectedConfirmadosCount = pedidosConfirmados.filter((s) => selectedSaleIds.has(s.id)).length;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex flex-col items-center mb-6">
          <HeaderConfig
            title="Atención al Cliente"
            description="Gestión de llamadas y confirmación de pedidos"
          />
        </div>

        {/* Tabs para las 3 categorías */}
        <Tabs defaultValue="preparados" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="preparados">
              Pedidos Preparados ({pedidosPreparados.length})
            </TabsTrigger>
            <TabsTrigger value="no_confirmados" className="text-red-600">
              Pedidos NO CONFIRMADOS ({pedidosNoConfirmados.length})
            </TabsTrigger>
            <TabsTrigger value="confirmados" className="text-green-600">
              Pedidos CONFIRMADOS ({pedidosConfirmados.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Pedidos Preparados */}
          <TabsContent value="preparados">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Preparados</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={selectedPreparadosCount === 0}
                    onClick={() => handleCopySelected(pedidosPreparados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({selectedPreparadosCount})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {renderTable(pedidosPreparados, "preparados")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Pedidos No Confirmados */}
          <TabsContent value="no_confirmados">
            <Card className="border-red-200">
              <CardHeader className="flex flex-row items-center justify-between bg-red-50">
                <CardTitle className="text-red-700">Pedidos NO CONFIRMADOS</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={selectedNoConfirmadosCount === 0}
                    onClick={() => handleCopySelected(pedidosNoConfirmados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({selectedNoConfirmadosCount})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {renderTable(pedidosNoConfirmados, "no_confirmados")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Pedidos Confirmados */}
          <TabsContent value="confirmados">
            <Card className="border-green-200">
              <CardHeader className="flex flex-row items-center justify-between bg-green-50">
                <CardTitle className="text-green-700">Pedidos CONFIRMADOS</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={selectedConfirmadosCount === 0}
                    onClick={() => handleCopySelected(pedidosConfirmados)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar seleccionados ({selectedConfirmadosCount})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {renderTable(pedidosConfirmados, "confirmados")}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de Resumen/Recibo */}
      <OrderReceiptModal
        open={receiptOpen}
        orderId={selectedOrderId || ""}
        onClose={() => setReceiptOpen(false)}
        onStatusChange={fetchOrders}
      />

      {/* Modal de Comentarios */}
      <CommentsTimelineModal
        open={commentsModalOpen}
        onClose={() => {
          setCommentsModalOpen(false);
          setSelectedSaleForComments(null);
        }}
        orderId={selectedSaleForComments?.id || ""}
        orderNumber={selectedSaleForComments?.orderNumber || ""}
      />

      {/* Modal de Pagos */}
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

      {/* Modal de Atención al Cliente */}
      <CustomerServiceModal
        open={customerServiceModalOpen}
        onClose={() => {
          setCustomerServiceModalOpen(false);
          setSelectedSaleForService(null);
        }}
        orderId={selectedSaleForService?.id || ""}
        onOrderUpdated={fetchOrders}
      />
    </div>
  );
}
