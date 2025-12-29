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
  };
}

/* -----------------------------------------
   Page
----------------------------------------- */

export default function FinanzasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [regionFilterDespachado, setRegionFilterDespachado] = useState<
    "" | "LIMA" | "PROVINCIA"
  >("");
  const [regionFilterEntregado, setRegionFilterEntregado] = useState<
    "" | "LIMA" | "PROVINCIA"
  >("");

  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(
    new Set()
  );

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

  const handleChangeStatus = async (saleId: string, newStatus: OrderStatus) => {
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${saleId}`,
        { status: newStatus }
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchOrders();
    } catch (error) {
      console.error("Error actualizando estado", error);
      toast.error("No se pudo actualizar el estado");
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
                {ALL_STATUSES.map((status) => (
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
              <Button
                size="icon"
                variant="outline"
                onClick={() => router.push(`/registrar-venta?orderId=${sale.id}`)}
              >
                <Pencil className="h-4 w-4" />
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
              <Button
                size="icon"
                variant="outline"
                onClick={() => router.push(`/registrar-venta?orderId=${sale.id}`)}
              >
                <Pencil className="h-4 w-4" />
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

  const despachados = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.status === ORDER_STATUS.EN_ENVIO &&
          (regionFilterDespachado === "" || s.salesRegion === regionFilterDespachado)
      ),
    [sales, regionFilterDespachado]
  );

  const entregados = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.status === ORDER_STATUS.ENTREGADO &&
          (regionFilterEntregado === "" || s.salesRegion === regionFilterEntregado)
      ),
    [sales, regionFilterEntregado]
  );

  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex flex-col items-center mb-6">
          <HeaderConfig
            title="Finanzas"
            description="Gestión de pedidos despachados y entregados"
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

        {/* Card Despachados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pedidos Despachados</CardTitle>
            <Button
              variant="outline"
              disabled={selectedSaleIds.size === 0}
              onClick={() => handleCopySelected("EN_ENVIO")}
            >
              Copiar seleccionados ({despachados.filter((s) => selectedSaleIds.has(s.id)).length})
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <Label>Filtrar por región:</Label>
              <select
                className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
                value={regionFilterDespachado}
                onChange={(e) =>
                  setRegionFilterDespachado(e.target.value as "" | "LIMA" | "PROVINCIA")
                }
              >
                <option value="">Todas</option>
                <option value="LIMA">Lima</option>
                <option value="PROVINCIA">Provincia</option>
              </select>
            </div>
            {renderDespachadosTable(despachados)}
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

        {/* Card Entregados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pedidos Entregados</CardTitle>
            <Button
              variant="outline"
              disabled={selectedSaleIds.size === 0}
              onClick={() => handleCopySelected("ENTREGADO")}
            >
              Copiar seleccionados ({entregados.filter((s) => selectedSaleIds.has(s.id)).length})
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <Label>Filtrar por región:</Label>
              <select
                className="border rounded-md px-2 py-1 text-sm bg-background text-foreground"
                value={regionFilterEntregado}
                onChange={(e) =>
                  setRegionFilterEntregado(e.target.value as "" | "LIMA" | "PROVINCIA")
                }
              >
                <option value="">Todas</option>
                <option value="LIMA">Lima</option>
                <option value="PROVINCIA">Provincia</option>
              </select>
            </div>
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
      </main>

      <OrderReceiptModal
        open={receiptOpen}
        orderId={selectedOrderId || ""}
        onClose={() => setReceiptOpen(false)}
        onStatusChange={fetchOrders}
      />
    </div>
  );
}
