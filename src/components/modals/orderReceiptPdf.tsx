import { Fragment } from "react";
import type { OrderReceipt } from "@/utils/printOrderLabel";
import { getPrintableUnitCodes } from "@/utils/receiptUnitCodes";

interface Props {
  data: OrderReceipt & { totals: OrderReceipt["totals"] & { subtotal?: number } };
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
      <style>{`@media print { #receipt-pdf thead { display: table-header-group; } #receipt-pdf tr { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>Comprobante de Venta</h2>

      <p>Orden Nº {orderNumber}</p>
      <p>Fecha: {new Date(createdAt).toLocaleString()}</p>

      <hr style={{ margin: "12px 0" }} />

      <p>
        <strong>Cliente</strong>
      </p>
      <p>{customer.fullName}</p>
      <p>{customer.phoneNumber}</p>
      <p>{customer.address}</p>

      <table width="100%" style={{ marginTop: "16px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Producto</th>
            <th align="center">Cant.</th>
            <th align="right">Precio</th>
            <th align="right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const tracking = getPrintableUnitCodes(data, item);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: Receipt rows are a static print snapshot without row state.
              <Fragment key={`${item.sku ?? item.productName}:${index}`}>
                <tr>
                  <td>{item.productName}</td>
                  <td align="center">{item.quantity}</td>
                  <td align="right">${item.unitPrice}</td>
                  <td align="right">${item.subtotal}</td>
                </tr>
                {tracking?.codes.map((code) => (
                  <tr key={code}>
                    <td
                      colSpan={4}
                      style={{
                        padding: "2px 0 4px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {tracking.label}: {code}
                    </td>
                  </tr>
                ))}
                {tracking?.notice && (
                  <tr>
                    <td colSpan={4} style={{ fontSize: "11px", padding: "4px 0" }}>
                      {tracking.notice}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <hr style={{ margin: "16px 0" }} />

      <table width="100%">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td align="right">${totals.subtotal ?? totals.productsTotal}</td>
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
