import { OrderStatus } from "@/interfaces/IOrder";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  data: any;
}

const STATUS_STYLES: Record<
  OrderStatus,
  { bg: string; text: string; label: string }
> = {
  INCOMPLETE: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    label: "Incompleto",
  },
  PREVENTA: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    label: "Pre-Venta",
  },
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
  PAGADO: {
    bg: "bg-green-100",
    text: "text-green-700",
    label: "Pagado",
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
    <div id="receipt-content" className="p-6 text-sm min-w-0">
      {/* Status Badge */}
      <Badge
        className={`${statusStyle.bg} ${statusStyle.text} mb-6 rounded-md px-4 py-1.5 text-sm font-medium`}
      >
        {statusStyle.label}
      </Badge>

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
            <Alert className="mb-6 border-green-200 bg-green-50">
              <AlertTitle className="text-green-800">✅ Pago Completo</AlertTitle>
              <AlertDescription className="text-green-700 break-words">
                {approvedPaymentsCount} pago(s) aprobado(s) - Total: S/ {totalPaidApproved.toFixed(2)}
              </AlertDescription>
            </Alert>
          );
        }

        // Caso 2: Hay pagos pendientes de revisión
        if (pendingPaymentsCount > 0) {
          return (
            <Alert className="mb-6 border-yellow-200 bg-yellow-50">
              <AlertTitle className="text-yellow-800">⏳ Pagos Pendientes de Aprobación</AlertTitle>
              <AlertDescription className="text-yellow-700 break-words">
                <p>{pendingPaymentsCount} pago(s) en revisión por S/ {totalPendingApproval.toFixed(2)}</p>
                {approvedPaymentsCount > 0 && (
                  <p className="text-green-700 mt-1">
                    ✓ {approvedPaymentsCount} pago(s) aprobado(s) por S/ {totalPaidApproved.toFixed(2)}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          );
        }

        // Caso 3: Falta monto (sin pagos pendientes de revisión)
        if (pendingAmount > 0) {
          return (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTitle className="text-red-800">💰 Pago Pendiente</AlertTitle>
              <AlertDescription className="text-red-700 break-words">
                <p>Falta por pagar: S/ {pendingAmount.toFixed(2)}</p>
                {approvedPaymentsCount > 0 && (
                  <p className="text-green-700 mt-1">
                    ✓ Adelanto aprobado: S/ {totalPaidApproved.toFixed(2)}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          );
        }

        return null;
      })()}

      {/* Payment Warning Alert - Only shown when there's pending balance and not ANULADO */}
      {pendingAmount > 0 && status !== 'ANULADO' && (
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTitle className="text-amber-800">
            ⚠️ Atención: Validación de Pago pendiente
          </AlertTitle>
          <AlertDescription className="text-amber-800 break-words">
            <p>
              Tenga en cuenta que para realizar el despacho es{" "}
              <strong>obligatorio</strong> que el cliente realice el pago en
              su totalidad antes de la entrega.
            </p>
            <p>
              Por favor, contacte con el cliente para validar el pago y
              asegúrese de adjuntar el comprobante correspondiente antes de
              proceder.
            </p>
            <p className="font-bold text-amber-900">
              ⚠️ IMPORTANTE: Sin la validación del pago, el motorizado o la
              empresa de transportes no está autorizado a entregar el paquete.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Order Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">No de Orden # {orderNumber}</h2>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <p className="text-lg font-semibold">
            Total: S/{Number(totals.grandTotal).toFixed(2)}
          </p>
          {pendingAmount > 0 ? (
            <Badge className="bg-red-100 text-red-700">
              Por cobrar S/ {pendingAmount.toFixed(2)}
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700">Pagado</Badge>
          )}
        </div>
      </div>

      {/* Customer & Order Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm [&>div]:min-w-0 [&>div]:break-words">
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
        <div>
          <span className="text-muted-foreground">Link Maps: </span>
          {customer.googleMapsUrl ? (
            <a
              href={customer.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-medium underline underline-offset-2"
            >
              Ver ubicación
            </a>
          ) : (
            <span className="text-black-600 font-medium">-</span>
          )}
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
        <div className="flex justify-between text-muted-foreground">
          <span>Productos:</span>
          <span>S/ {Number(totals.productsTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>IGV 18%:</span>
          <span>S/ {Number(totals.taxTotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Envío:</span>
          <span>S/ {Number(totals.shippingTotal).toFixed(2)}</span>
        </div>
        {Number(totals.discountTotal) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Descuentos:</span>
            <span>- S/ {Number(totals.discountTotal).toFixed(2)}</span>
          </div>
        )}
        {/* Total — ya no es el elemento más destacado de la sección: cuando
            hay un adelanto parcial, el cliente lo confundía con "el adelanto
            no se aplicó" porque este número no cambiaba. Ahora el
            protagonista es "Por Cobrar" (o el check de pagado) más abajo. */}
        <div className="flex justify-between font-medium border-t pt-2 mt-2">
          <span>Total:</span>
          <span>S/ {Number(totals.grandTotal).toFixed(2)}</span>
        </div>

        {totalPaid > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>✓ Adelanto pagado:</span>
            <span>S/ {totalPaid.toFixed(2)}</span>
          </div>
        )}

        {pendingAmount > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <span className="font-bold text-red-700">Por Cobrar</span>
            <span className="text-lg font-extrabold text-red-700">
              S/ {pendingAmount.toFixed(2)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <span className="font-bold text-emerald-700">
              ✓ Pagado en su totalidad
            </span>
          </div>
        )}
      </div>
    </div>
  );
}