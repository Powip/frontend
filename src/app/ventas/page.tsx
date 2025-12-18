"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";

export type SaleStatus = "PENDIENTE" | "CONFIRMADA" | "PAGADA" | "ANULADA";

export interface Sale {
  id: string;
  clientName: string;
  date: string;
  total: number;
  status: SaleStatus;
  paymentMethod: string;
  deliveryType: string;
}
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function mapOrderStatusToSaleStatus(status: OrderStatus): SaleStatus {
  switch (status) {
    case "PENDIENTE":
      return "PENDIENTE";

    case "CONFIRMADA":
    case "EN_PREPARACION":
    case "ENVIADA":
    case "ENTREGADA":
      return "CONFIRMADA";

    case "PAGADA":
      return "PAGADA";

    case "ANULADA":
      return "ANULADA";

    default:
      return "PENDIENTE";
  }
}

function mapOrderToSale(order: OrderHeader): Sale {
  return {
    id: order.id,
    clientName: order.customer.fullName,
    date: new Date(order.created_at).toLocaleDateString("es-AR"),
    total: Number(order.grandTotal),
    status: mapOrderStatusToSaleStatus(order.status),
    paymentMethod:
      order.payments.length > 0 ? order.payments[0].paymentMethod : "—",
    deliveryType: order.deliveryType.replace("_", " "),
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */
export default function VentasPage() {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const { auth, selectedStoreId } = useAuth();

  useEffect(() => {
    if (!selectedStoreId) return;

    async function fetchOrders() {
      try {
        const res = await axios.get<OrderHeader[]>(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
        );

        const mappedSales = res.data.map(mapOrderToSale);
        setSales(mappedSales);
      } catch (error) {
        console.error("Error fetching orders", error);
      }
    }

    fetchOrders();
  }, [selectedStoreId]);

  /* -----------------------------------------
     Helpers
  ----------------------------------------- */
  const statusVariant = (status: SaleStatus): BadgeVariant => {
    switch (status) {
      case "PAGADA":
        return "default";

      case "CONFIRMADA":
        return "secondary";

      case "PENDIENTE":
        return "outline";

      case "ANULADA":
        return "destructive";

      default:
        return "secondary";
    }
  };
  const handleDelete = (id: string) => {
    setSales((prev) => prev.filter((sale) => sale.id !== id));
  };

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Header */}
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

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Envío</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sales.map((sale, index) => (
                  <TableRow key={sale.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {sale.clientName}
                    </TableCell>
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
                      <Button size="icon" variant="outline">
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

                {sales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-6"
                    >
                      No hay ventas registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
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

/* boleta o factura es correcto pero puede ir en operaciones */
/* meotod de envio son los courier o empresas con las que hacemos envio (cargadas) */
/* los items del comprobante deben estar separados. */
/* El cliente puede consultar por un link el estado de su pedido/venta */
/* Todos los pedidos de lima y provincia se tratan diferente (separados)*/
/* Poder subir el comprobante de la tranferencia (registrar-venta) */
