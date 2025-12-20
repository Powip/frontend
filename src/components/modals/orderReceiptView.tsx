interface Props {
  data: any;
}

export default function OrderReceiptView({ data }: Props) {
  const { orderNumber, status, createdAt, customer, items, totals, payments } =
    data;

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
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Comprobante de Venta</h2>
          <p>Orden N° {orderNumber}</p>
          <p>Estado: {status}</p>
          <p>Fecha: {new Date(createdAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Cliente</p>
          <p>{customer.fullName}</p>
          <p>{customer.phoneNumber}</p>
          <p>{customer.address}</p>
        </div>
      </div>

      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Producto</th>
            <th className="text-center">Cant.</th>
            <th className="text-right">Precio</th>
            <th className="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {expandedItems.map((item: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2">
                {item.productName}
                {item.attributes && (
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(item.attributes)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </div>
                )}
              </td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">${item.unitPrice}</td>
              <td className="text-right">${item.subtotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex">
        <div className="w-full space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${totals.productsTotal}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA</span>
            <span>${totals.taxTotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Envío</span>
            <span>${totals.shippingTotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>-${totals.discountTotal}</span>
          </div>
          <div className="flex justify-between font-bold ">
            <span>Total</span>
            <span>${totals.grandTotal}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span>Pagado</span>
            <span>${totalPaid}</span>
          </div>
          <div className="flex justify-between">
            <span>Por cobrar</span>
            <span>${pendingAmount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
