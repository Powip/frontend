import { OrderStatus } from "@/interfaces/IOrder";

interface Props {
  data: any;
}

const STATUS_STYLES: Record<
  OrderStatus,
  { bg: string; text: string; label: string }
> = {
  PENDIENTE: {
    bg: "bg-red-500",
    text: "text-white",
    label: "Pendiente",
  },
  PREPARADO: {
    bg: "bg-yellow-500",
    text: "text-white",
    label: "Preparado",
  },
  LLAMADO: {
    bg: "bg-blue-500",
    text: "text-white",
    label: "Contactado",
  },
  ASIGNADO_A_GUIA: {
    bg: "bg-teal-500",
    text: "text-white",
    label: "En Guía",
  },
  EN_ENVIO: {
    bg: "bg-purple-500",
    text: "text-white",
    label: "En Envío",
  },
  ENTREGADO: {
    bg: "bg-green-500",
    text: "text-white",
    label: "Entregado",
  },
  ANULADO: {
    bg: "bg-gray-500",
    text: "text-white",
    label: "Anulado",
  },
};

export default function OrderReceiptView({ data }: Props) {

  const { orderNumber, status, customer, items, totals, payments, salesChannel, closingChannel } =
    data;

  const statusStyle = STATUS_STYLES[status as OrderStatus] ?? {
    bg: "bg-gray-400",
    text: "text-white",
    label: status,
  };

  // Expandir items: cada unidad como una fila separada
  const expandedItems = items.flatMap((item: any) =>
    Array.from({ length: item.quantity }, () => ({
      ...item,
      originalQuantity: item.quantity, // Guardar cantidad original para calcular descuento prorrateado
      quantity: 1,
      subtotal: item.unitPrice,
    }))
  );

  const totalPaid = Array.isArray(payments)
    ? payments.reduce(
        (acc: number, payment: any) => acc + Number(payment.amount || 0),
        0
      )
    : 0;

  const pendingAmount = Math.max(totals.grandTotal - totalPaid, 0);

  return (
    <div id="receipt-content" className="p-6 text-sm">
      {/* Status Badge */}
      <div
        className={`${statusStyle.bg} ${statusStyle.text} px-4 py-3 rounded-md mb-6 font-medium`}
      >
        {statusStyle.label}
      </div>

      {/* Payment Status Banner */}
      {(() => {
        const totalPaidApproved = totals.totalPaid || 0;
        const totalPendingApproval = totals.totalPendingApproval || 0;
        const pendingPaymentsCount = totals.pendingPaymentsCount || 0;
        const approvedPaymentsCount = totals.approvedPaymentsCount || 0;
        const total = totals.grandTotal || 0;
        
        // Caso 1: Completamente pagado (aprobado)
        if (totalPaidApproved >= total) {
          return (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800">Pago Completo</p>
                  <p className="text-sm text-green-700">
                    {approvedPaymentsCount} pago(s) aprobado(s) - Total: S/ {totalPaidApproved.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        
        // Caso 2: Hay pagos pendientes de revisión
        if (pendingPaymentsCount > 0) {
          return (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div>
                  <p className="font-semibold text-yellow-800">Pagos Pendientes de Aprobación</p>
                  <p className="text-sm text-yellow-700">
                    {pendingPaymentsCount} pago(s) en revisión por S/ {totalPendingApproval.toFixed(2)}
                  </p>
                  {approvedPaymentsCount > 0 && (
                    <p className="text-sm text-green-700 mt-1">
                      ✓ {approvedPaymentsCount} pago(s) aprobado(s) por S/ {totalPaidApproved.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }
        
        // Caso 3: Falta monto (sin pagos pendientes de revisión)
        if (pendingAmount > 0) {
          return (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <p className="font-semibold text-red-800">Pago Pendiente</p>
                  <p className="text-sm text-red-700">
                    Falta por pagar: S/ {pendingAmount.toFixed(2)}
                  </p>
                  {approvedPaymentsCount > 0 && (
                    <p className="text-sm text-green-700 mt-1">
                      ✓ Adelanto aprobado: S/ {totalPaidApproved.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }
        
        return null;
      })()}

      {/* Payment Warning Alert - Only shown when there's pending balance and not ANULADO */}
      {pendingAmount > 0 && status !== "ANULADO" && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-md">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-2">
                Estimado cliente, por favor tenga en cuenta que el despacho está programado.
                Es obligatorio realizar el pago del saldo pendiente antes de la entrega:
              </p>
              <p className="mb-2">
                💰 <strong>PAGO:</strong> Yape o Plin al <strong>970334874</strong> o CTA BCP (Corporación Aranni SAC).
              </p>
              <p className="mb-2">
                📩 <strong>CONFIRMACIÓN:</strong> Envía el comprobante por WhatsApp al <strong>960255616</strong>.
              </p>
              <p className="font-bold text-amber-900 mt-3">
                ⚠️ IMPORTANTE: Sin la validación del pago, el motorizado o la empresa de transportes no está autorizado a entregar el paquete.
              </p>
              <p className="mt-2 text-amber-700">¡Gracias por su colaboración!</p>
            </div>
          </div>
        </div>
      )}

      {/* Order Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">No de Orden # {orderNumber}</h2>
        <p className="text-lg font-semibold">Total: S/{Number(totals.grandTotal).toFixed(2)}</p>
      </div>

      {/* Customer & Order Info Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
        <div>
          <span className="text-muted-foreground">Nombre: </span>
          <span className="text-black-600 font-medium">{customer.fullName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Distrito: </span>
          <span className="text-black-600 font-medium">{customer.district || "-"}</span>
        </div>

        <div>
          <span className="text-muted-foreground">Teléfono: </span>
          <span className="text-black-600 font-medium">{customer.phoneNumber}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Tipo: </span>
          <span className="text-black-600 font-medium">{customer.clientType}</span>
        </div>

        <div>
          <span className="text-muted-foreground">Dirección: </span>
          <span className="text-black-600 font-medium">{customer.address || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Referencia: </span>
          <span className="text-black-600 font-medium">{customer.reference || "-"}</span>
        </div>

        <div>
          <span className="text-muted-foreground">Departamento: </span>
          <span className="text-black-600 font-medium">{customer.city || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Canal Venta: </span>
          <span className="text-black-600 font-medium">{salesChannel || "-"}</span>
        </div>

        <div>
          <span className="text-muted-foreground">Provincia: </span>
          <span className="text-black-600 font-medium">{customer.province || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Canal Cierre: </span>
          <span className="text-black-600 font-medium">{closingChannel || "-"}</span>
        </div>

        <div>
          <span className="text-muted-foreground">Dni: </span>
          <span className="text-black-600 font-medium">{customer.dni || customer.documentNumber || "-"}</span>
        </div>
      </div>

      {/* Products Section */}
      <div className="mb-6">
        <h3 className="font-bold mb-3">Productos</h3>
        <div className="space-y-3">
          {expandedItems.map((item: any, i: number) => {
            // Calcular el descuento prorrateado por unidad
            const discountPerUnit = item.originalQuantity > 0 
              ? (Number(item.discountAmount) || 0) / item.originalQuantity 
              : 0;
            const subtotalWithDiscount = item.unitPrice - discountPerUnit;
            
            return (
              <div key={i} className="border rounded-md p-3 flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-black-600 font-medium">{item.productName}</p>
                  {item.attributes && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {Object.entries(item.attributes).map(([k, v]) => (
                        <p key={k}>
                          <span className="text-muted-foreground">{k}: </span>
                          <span className="text-black-600 font-medium">{String(v)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs">
                    <span className="text-muted-foreground">Cantidad: </span>
                    <span className="text-black-600 font-medium">{item.quantity}</span>
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Valor Und: </span>
                    <span className="text-black-600 font-medium">S/ {Number(item.unitPrice).toFixed(2)}</span>
                  </p>
                  {discountPerUnit > 0 && (
                    <p className="text-xs text-red-600">
                      <span className="text-muted-foreground">Descuento: </span>
                      <span className="font-medium">- S/ {discountPerUnit.toFixed(2)}</span>
                    </p>
                  )}
                  <p className="text-xs">
                    <span className="text-muted-foreground">Sub Total: </span>
                    <span className="text-black-600 font-medium">S/ {subtotalWithDiscount.toFixed(2)}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals Section */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Productos:</span>
          <span>S/ {Number(totals.productsTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IGV 18%:</span>
          <span>S/ {Number(totals.taxTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Envío:</span>
          <span>S/ {Number(totals.shippingTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
          <span>Total:</span>
          <span>S/ {Number(totals.grandTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Descuentos:</span>
          <span>S/ {Number(totals.discountTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Adelanto:</span>
          <span>S/ {totalPaid.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Por Cobrar:</span>
          <span>S/ {pendingAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
