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

import {
  OrderHeader,
  OrderStatus,
} from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";

/* -----------------------------------------
   Types
----------------------------------------- */

const  ORDER_STATUS= {
 PENDIENTE: "PENDIENTE",
  PREPARADO: "PREPARADO",
  LLAMADO: "LLAMADO",
  EN_ENVIO: "EN_ENVIO",
  ENTREGADO: "ENTREGADO",
  ANULADO: "ANULADO",
}

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

  const { selectedStoreId } = useAuth();

  useEffect(() => {
    if (!selectedStoreId) return;

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

    fetchOrders();
  }, [selectedStoreId]);

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
            <TableCell className="font-medium">
              {sale.orderNumber}
            </TableCell>
            <TableCell>{sale.clientName}</TableCell>
            <TableCell>{sale.phoneNumber}</TableCell>
            <TableCell>{sale.date}</TableCell>
            <TableCell>{sale.paymentMethod}</TableCell>
            <TableCell>{sale.deliveryType}</TableCell>
            <TableCell>${sale.total.toFixed(2)}</TableCell>
            <TableCell>
              <Badge variant={statusVariant(sale.status)}>
                {sale.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setSelectedSale(sale);
                  setEditOpen(true);
                }}
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
              <TabsContent value="pendiente">{renderTable(pendientes)}</TabsContent>
              <TabsContent value="preparado">{renderTable(preparados)}</TabsContent>
              <TabsContent value="contactado">{renderTable(contactados)}</TabsContent>
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
              <TabsContent value="despachado">{renderTable(despachados)}</TabsContent>
              <TabsContent value="entregado">{renderTable(entregados)}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Modal editar venta */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar venta</DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <Input defaultValue={selectedSale.clientName} />
              </div>

              <div>
                <Label>Teléfono</Label>
                <Input defaultValue={selectedSale.phoneNumber} />
              </div>

              <div>
                <Label>Tipo de envío</Label>
                <Input defaultValue={selectedSale.deliveryType} />
              </div>

              <div>
                <Label>Método de pago</Label>
                <Input defaultValue={selectedSale.paymentMethod} />
              </div>

              <div>
                <Label>Estado</Label>
                <Input defaultValue={selectedSale.status} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button className="bg-teal-600 hover:bg-teal-700">
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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