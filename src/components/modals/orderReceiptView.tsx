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
  const { orderNumber, status, customer, items, totals, payments, salesChannel } =
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

      {/* Order Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">No de Orden # {orderNumber}</h2>
        <p className="text-lg font-semibold">Total: S/{totals.grandTotal}</p>
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
          <span className="text-muted-foreground">Canal: </span>
          <span className="text-black-600 font-medium">{salesChannel || "-"}</span>
        </div>

        <div>
          <span className="text-muted-foreground">Provincia: </span>
          <span className="text-black-600 font-medium">{customer.province || "-"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Dni: </span>
          <span className="text-black-600 font-medium">{customer.documentNumber || "-"}</span>
        </div>
      </div>

      {/* Products Section */}
      <div className="mb-6">
        <h3 className="font-bold mb-3">Productos</h3>
        <div className="space-y-3">
          {expandedItems.map((item: any, i: number) => (
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
                  <span className="text-black-600 font-medium">S/ {item.unitPrice}</span>
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Sub Total: </span>
                  <span className="text-black-600 font-medium">S/ {item.subtotal}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Section */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Productos:</span>
          <span>S/ {totals.productsTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IGV 18%:</span>
          <span>S/ {totals.taxTotal}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Envío:</span>
          <span>S/ {totals.shippingTotal}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
          <span>Total:</span>
          <span>S/ {totals.grandTotal}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Descuentos:</span>
          <span>S/ {totals.discountTotal}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Adelanto:</span>
          <span>S/ {totalPaid}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Por Cobrar:</span>
          <span>S/ {pendingAmount}</span>
        </div>
      </div>
    </div>
  );
}
