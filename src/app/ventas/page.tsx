"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";
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
import { toast } from "sonner";
import { ORDER_STATUS_FLOW } from "@/utils/domain/orders-status-flow";

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
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </>
  );
}

/* -----------------------------------------
   Mapper
----------------------------------------- */

function mapOrderToSale(order: OrderHeader): Sale {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.customer.fullName,
    phoneNumber: order.customer.phoneNumber,
    date: new Date(order.created_at).toLocaleDateString("es-AR"),
    total: Number(order.grandTotal),
    status: order.status,
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<OrderHeader | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [editStatus, setEditStatus] = useState<OrderStatus | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editCancellationReason, setEditCancellationReason] = useState("");
  const [productsOpen, setProductsOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const { selectedStoreId } = useAuth();

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
  async function fetchOrderById(orderId: string) {
    try {
      setLoadingOrder(true);

      const response = await axios.get<OrderHeader>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`
      );

      setSelectedOrder(response.data);
      setEditOpen(true);
    } catch (error) {
      console.error("Error fetching order by id", error);
    } finally {
      setLoadingOrder(false);
    }
  }
  const handleSave = () => {
    if (
      selectedOrder &&
      editStatus === "ANULADO" &&
      selectedOrder.status !== "ANULADO"
    ) {
      if (editStatus === "ANULADO" && !editCancellationReason) {
        toast.warning("Debés seleccionar un motivo de cancelación");
        return;
      }

      setConfirmCancelOpen(true);
      return;
    }

    submitUpdate();
  };

  const submitUpdate = async () => {
    if (!selectedOrder || !editStatus) return;

    const payload: Record<string, any> = {
      status: editStatus,
      notes: editNotes,
    };

    if (editStatus === "ANULADO") {
      payload.cancellationReason = editCancellationReason;
    }

    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${selectedOrder.id}`,
        payload
      );

      setEditOpen(false);
      setConfirmCancelOpen(false);
      fetchOrders();
    } catch (error) {
      console.error("Error updating order", error);
    }
  };

  useEffect(() => {
    if (!selectedStoreId) return;

    fetchOrders();
  }, [selectedStoreId]);

  useEffect(() => {
    if (!selectedOrder) return;

    setEditStatus(selectedOrder.status);
    setEditNotes(selectedOrder.notes || "");
    setEditCancellationReason(selectedOrder.cancellationReason || "");
  }, [selectedOrder]);

  const expandedItems = useMemo(() => {
    if (!selectedOrder) return [];

    return selectedOrder.items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        id: item.id,
        productName: item.productName,
        attributes: item.attributes,
      }))
    );
  }, [selectedOrder]);

  const allowedStatuses = useMemo<OrderStatus[]>(() => {
    if (!selectedOrder) return [];

    return [selectedOrder.status, ...ORDER_STATUS_FLOW[selectedOrder.status]];
  }, [selectedOrder]);
  /* -----------------------------------------
     Helpers
  ----------------------------------------- */

  const statusVariant = (status: OrderStatus): BadgeVariant => {
    switch (status) {
      case ORDER_STATUS.ENTREGADO:
        return "default";
      case ORDER_STATUS.EN_ENVIO:
      case ORDER_STATUS.LLAMADO:
        return "secondary";
      case ORDER_STATUS.PENDIENTE:
      case ORDER_STATUS.PREPARADO:
        return "outline";
      case ORDER_STATUS.ANULADO:
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleDelete = (id: string) => {
    setSales((prev) => prev.filter((sale) => sale.id !== id));
  };

  const renderTable = (data: Sale[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>N° Orden</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Pago</TableHead>
          <TableHead>Envío</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="font-medium">{sale.orderNumber}</TableCell>
            <TableCell>{sale.clientName}</TableCell>
            <TableCell>{sale.phoneNumber}</TableCell>
            <TableCell>{sale.date}</TableCell>
            <TableCell>{sale.paymentMethod}</TableCell>
            <TableCell>{sale.deliveryType}</TableCell>
            <TableCell>${sale.total.toFixed(2)}</TableCell>
            <TableCell>
              <Badge variant={statusVariant(sale.status)}>{sale.status}</Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => fetchOrderById(sale.id)}
              >
                <Pencil className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setSelectedOrderId(sale.id);
                  setReceiptOpen(true);
                }}
              >
                <FileText className="h-4 w-4" />
              </Button>

              {/* <Button
                size="icon"
                variant="destructive"
                onClick={() => handleDelete(sale.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button> */}
            </TableCell>
          </TableRow>
        ))}

        {data.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={9}
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

  const pendientes = useMemo(
    () => sales.filter((s) => s.status === ORDER_STATUS.PENDIENTE),
    [sales]
  );
  const preparados = useMemo(
    () => sales.filter((s) => s.status === ORDER_STATUS.PREPARADO),
    [sales]
  );
  const contactados = useMemo(
    () => sales.filter((s) => s.status === ORDER_STATUS.LLAMADO),
    [sales]
  );
  const despachados = useMemo(
    () => sales.filter((s) => s.status === ORDER_STATUS.EN_ENVIO),
    [sales]
  );
  const entregados = useMemo(
    () => sales.filter((s) => s.status === ORDER_STATUS.ENTREGADO),
    [sales]
  );

  const totalPaid =
    selectedOrder?.payments?.reduce(
      (acc, p) => acc + Number(p.amount || 0),
      0
    ) || 0;

  const pendingAmount = selectedOrder
    ? Number(selectedOrder.grandTotal) - totalPaid
    : 0;

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <HeaderConfig
            title="Ventas"
            description="Listado de ventas registradas"
          />
          <Link href="/registrar-venta">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva venta
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gestión de pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pendiente">
              <TabsList>
                <TabsTrigger value="pendiente">Pendiente</TabsTrigger>
                <TabsTrigger value="preparado">Preparado</TabsTrigger>
                <TabsTrigger value="contactado">Contactado</TabsTrigger>
              </TabsList>
              <TabsContent value="pendiente">
                {renderTable(pendientes)}
              </TabsContent>
              <TabsContent value="preparado">
                {renderTable(preparados)}
              </TabsContent>
              <TabsContent value="contactado">
                {renderTable(contactados)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despacho y entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="despachado">
              <TabsList>
                <TabsTrigger value="despachado">Despachado</TabsTrigger>
                <TabsTrigger value="entregado">Entregado</TabsTrigger>
              </TabsList>
              <TabsContent value="despachado">
                {renderTable(despachados)}
              </TabsContent>
              <TabsContent value="entregado">
                {renderTable(entregados)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Modal editar venta */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              {/* ---------- Header ---------- */}
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Editar Venta {selectedOrder.orderNumber}
                </DialogTitle>
              </DialogHeader>

              {/* ---------- Info tipo tabla ---------- */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-4">
                <InfoRow label="Pendiente a pagar">
                  ${pendingAmount.toFixed(2)}
                </InfoRow>

                <InfoRow label="Provincia">
                  {selectedOrder.customer.province}
                </InfoRow>

                <InfoRow label="Distrito">
                  {selectedOrder.customer.district}
                </InfoRow>

                <InfoRow label="Dirección">
                  {selectedOrder.customer.address}
                </InfoRow>

                <InfoRow label="Teléfono">
                  {selectedOrder.customer.phoneNumber}
                </InfoRow>

                <InfoRow label="DNI">
                  {selectedOrder.customer.documentNumber ?? "No aplica"}
                </InfoRow>

                <InfoRow label="Tipo de gestión">
                  {selectedOrder.orderType}
                </InfoRow>

                <InfoRow label="Canal de venta">
                  {selectedOrder.salesChannel}
                </InfoRow>

                <InfoRow label="Productos">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProductsOpen(true)}
                  >
                    Ver productos
                  </Button>
                </InfoRow>

                <InfoRow label="Comprobante de venta">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrderId(selectedOrder.id);
                      setReceiptOpen(true);
                    }}
                  >
                    Ver orden
                  </Button>
                </InfoRow>
              </div>

              {/* ---------- Pagos / Gestión ---------- */}
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Método de pago</Label>
                  <Input
                    disabled
                    value={
                      selectedOrder.payments[0]?.paymentMethod ?? "No definido"
                    }
                  />
                </div>

                <div>
                  <Label>Observaciones</Label>
                  <Input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Estado</Label>
                  <select
                    value={editStatus ?? ""}
                    onChange={(e) =>
                      setEditStatus(e.target.value as OrderStatus)
                    }
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {allowedStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ---------- Motivo cancelación ---------- */}
                {editStatus === "ANULADO" && (
                  <div>
                    <Label>Motivo de cancelación</Label>
                    <select
                      value={editCancellationReason}
                      onChange={(e) =>
                        setEditCancellationReason(e.target.value)
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar motivo</option>
                      <option value="CLIENTE">Cancelado por el cliente</option>
                      <option value="STOCK">Sin stock</option>
                      <option value="ERROR">Error en la venta</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ---------- Footer ---------- */}
              <div className="flex justify-end gap-2 pt-6">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={handleSave}
                >
                  Guardar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Productos */}
      <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Productos de la venta</DialogTitle>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expandedItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {Object.entries(item.attributes)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </TableCell>
                  <TableCell className="text-center">1</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venta</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de cancelar la venta{" "}
              <strong>{selectedOrder?.orderNumber}</strong>.
              <br />
              Motivo:{" "}
              <strong>
                {editCancellationReason || "Sin motivo especificado"}
              </strong>
              <br />
              <br />
              Esta acción no se puede deshacer. ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={submitUpdate}
            >
              Confirmar cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderReceiptModal
        open={receiptOpen}
        orderId={selectedOrderId}
        onClose={() => {
          setReceiptOpen(false);
          setSelectedOrderId(null);
        }}
      />
    </div>
  );
}
