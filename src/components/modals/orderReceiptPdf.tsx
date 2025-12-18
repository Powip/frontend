interface Props {
  data: any;
}

export default function OrderReceiptPdf({ data }: Props) {
  const { orderNumber, createdAt, customer, items, totals } = data;

  return (
    <div
      id="receipt-pdf"
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#000",
        backgroundColor: "#fff",
        padding: "24px",
      }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>
        Comprobante de Venta
      </h2>

      <p>Orden Nº {orderNumber}</p>
      <p>Fecha: {new Date(createdAt).toLocaleString()}</p>

      <hr style={{ margin: "12px 0" }} />

      <p>
        <strong>Cliente</strong>
      </p>
      <p>{customer.fullName}</p>
      <p>{customer.phoneNumber}</p>
      <p>{customer.address}</p>

      <table
        width="100%"
        style={{ marginTop: "16px", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th align="left">Producto</th>
            <th align="center">Cant.</th>
            <th align="right">Precio</th>
            <th align="right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={i}>
              <td>{item.productName}</td>
              <td align="center">{item.quantity}</td>
              <td align="right">${item.unitPrice}</td>
              <td align="right">${item.subtotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: "16px 0" }} />

      <table width="100%">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td align="right">${totals.subtotal}</td>
          </tr>
          <tr>
            <td>IVA</td>
            <td align="right">${totals.taxTotal}</td>
          </tr>
          <tr>
            <td>Envío</td>
            <td align="right">${totals.shippingTotal}</td>
          </tr>
          <tr>
            <td>Descuento</td>
            <td align="right">-${totals.discountTotal}</td>
          </tr>
          <tr>
            <td>
              <strong>Total</strong>
            </td>
            <td align="right">
              <strong>${totals.grandTotal}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
