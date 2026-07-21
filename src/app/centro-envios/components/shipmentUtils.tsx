import { OrderHeader } from "@/interfaces/IOrder";
import { Badge } from "@/components/ui/badge";

export function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getPendingPayment(order: OrderHeader): number {
  const total = Number(order.grandTotal);
  const paid = order.payments
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  return Math.max(total - paid, 0);
}

export function getPaidAmount(order: OrderHeader): number {
  return order.payments
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
}

export function isReassigned(order: OrderHeader): boolean {
  return !!order.notes?.includes("[REASIGNADO]");
}

export function isFailedDelivery(order: OrderHeader): boolean {
  return order.status === "EN_ENVIO" && order.shalomStatus === "DEVUELTO";
}

export function hasSyncError(order: OrderHeader): boolean {
  return (
    !!order.shalomError ||
    !!(order.syncErrors && Object.keys(order.syncErrors).length)
  );
}

export function trackingUrlFor(order: OrderHeader): string {
  const base = process.env.NEXT_PUBLIC_LANDING_URL || "https://www.powip.lat";
  return `${base}/rastreo/${order.orderNumber}`;
}

export function ShipmentBadge({ order }: { order: OrderHeader }) {
  if (order.status === "ENTREGADO") {
    return <Badge className="bg-green-100 text-green-800">✅ Entregado</Badge>;
  }
  if (order.status === "EN_ENVIO") {
    if (order.shalomStatus === "DEVUELTO") {
      return <Badge className="bg-red-100 text-red-800">⚠️ Devuelto</Badge>;
    }
    if (order.shalomStatus === "ENTREGADO") {
      return (
        <Badge className="bg-green-100 text-green-800">
          ✅ Entregado (courier)
        </Badge>
      );
    }
    if (order.shalomStatus === "EN_DESTINO") {
      return <Badge className="bg-amber-100 text-amber-800">🏢 En agencia</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-800">🚚 En tránsito</Badge>;
  }
  if (order.status === "ASIGNADO_A_GUIA") {
    return <Badge className="bg-blue-100 text-blue-800">Asignado a guía</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-700">Preparado</Badge>;
}

export function PaymentBadge({ order }: { order: OrderHeader }) {
  const pending = getPendingPayment(order);
  const total = Number(order.grandTotal);
  if (pending <= 0) {
    return <Badge className="bg-green-100 text-green-800">Pagado</Badge>;
  }
  if (pending < total) {
    return (
      <Badge className="bg-amber-100 text-amber-800">
        Saldo S/{pending.toFixed(2)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800">
      Por cobrar S/{total.toFixed(2)}
    </Badge>
  );
}

export function IntegrationBadge({ order }: { order: OrderHeader }) {
  if (!order.courier) {
    return <Badge className="bg-gray-100 text-gray-700">Sin registrar</Badge>;
  }
  if (order.courier !== "Shalom") {
    return order.guideNumber ? (
      <Badge className="bg-gray-100 text-gray-700">{order.courier}</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-700">Sin registrar</Badge>
    );
  }
  if (hasSyncError(order)) {
    return <Badge className="bg-red-100 text-red-800">Error agencia</Badge>;
  }
  if (order.shalomStatus === "DEVUELTO") {
    return <Badge className="bg-red-100 text-red-800">Devuelto</Badge>;
  }
  if (order.shalomStatus) {
    return <Badge className="bg-green-100 text-green-800">Shalom OK</Badge>;
  }
  if (order.guideNumber) {
    return <Badge className="bg-amber-100 text-amber-800">Pendiente envío</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-700">Sin registrar</Badge>;
}
