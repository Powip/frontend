import QRCode from 'qrcode';

/**
 * Receipt data structure matching the backend's OrderReceipt format
 */
export interface ReceiptData {
  orderId: string;
  orderNumber: string;
  salesChannel?: string;
  customer: {
    fullName: string;
    phoneNumber?: string;
    dni?: string;
    address?: string;
    district?: string;
    city?: string;
    province?: string;
    clientType?: string;
    reference?: string;
  };
  items: {
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discountAmount: number;
    attributes?: Record<string, any>;
  }[];
  totals: {
    productsTotal: number;
    taxTotal: number;
    shippingTotal: number;
    discountTotal: number;
    grandTotal: number;
    totalPaid: number;
    pendingAmount: number;
  };
}

/**
 * Generates a QR code data URL from text
 */
async function generateQR(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { width: 120 });
  } catch (err) {
    console.error('Error generating QR', err);
    return '';
  }
}

/**
 * Generates HTML for a single receipt in compact 80mm thermal format
 */
function generateReceiptHTML(receipt: ReceiptData, qrDataUrl: string, isLast: boolean): string {
  const totalPaid = receipt.totals.totalPaid || 0;
  const pendingAmount = receipt.totals.pendingAmount || 0;

  return `
    <div style="page-break-after: ${isLast ? 'auto' : 'always'}; max-width: 280px; margin: 0 auto; font-family: Arial, sans-serif; font-size: 11px; padding: 15px;">
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding-bottom: 8px; border-bottom: 1px dashed #333;">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width: 70px; height: 70px; flex-shrink: 0;">` : ''}
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">Orden # ${receipt.orderNumber}</div>
          <div style="font-size: 16px; font-weight: bold;">Total: S/ ${receipt.totals.grandTotal.toFixed(2)}</div>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 10px;">
          <div style="line-height: 1.3;">
            <span style="color: #666;">Nombre:</span>
            <span style="font-weight: 500;">${receipt.customer.fullName}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Distrito:</span>
            <span style="font-weight: 500;">${receipt.customer.district || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Teléfono:</span>
            <span style="font-weight: 500;">${receipt.customer.phoneNumber || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Tipo:</span>
            <span style="font-weight: 500;">${receipt.customer.clientType || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Dirección:</span>
            <span style="font-weight: 500;">${receipt.customer.address || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Referencia:</span>
            <span style="font-weight: 500;">${receipt.customer.reference || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Departamento:</span>
            <span style="font-weight: 500;">${receipt.customer.city || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Canal:</span>
            <span style="font-weight: 500;">${receipt.salesChannel || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">Provincia:</span>
            <span style="font-weight: 500;">${receipt.customer.province || '-'}</span>
          </div>
          <div style="line-height: 1.3;">
            <span style="color: #666;">DNI:</span>
            <span style="font-weight: 500;">${receipt.customer.dni || '-'}</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-weight: bold; margin-bottom: 6px; font-size: 12px;">Productos</div>
        <table style="width: 100%; font-size: 9px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: center; border-bottom: 1px solid #333; padding: 4px 2px; font-size: 8px; width: 25px;">Qty</th>
              <th style="text-align: left; border-bottom: 1px solid #333; padding: 4px 2px; font-size: 8px;">Producto</th>
              <th style="text-align: right; border-bottom: 1px solid #333; padding: 4px 2px; font-size: 8px;">Precio</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.items.map((item) => {
              const attrs = item.attributes ? Object.values(item.attributes).join('/') : '';
              const discount = Number(item.discountAmount) || 0;
              const subtotal = Number(item.subtotal);
              return `
                <tr>
                  <td style="padding: 3px 2px; border-bottom: 1px dotted #ddd; text-align: center; vertical-align: top;">${item.quantity}</td>
                  <td style="padding: 3px 2px; border-bottom: 1px dotted #ddd; vertical-align: top;">
                    ${item.productName}${attrs ? ` (${attrs})` : ''}
                    ${discount > 0 ? `<div style="font-size: 8px; color: #666;">Dcto: -S/${discount.toFixed(2)}</div>` : ''}
                  </td>
                  <td style="padding: 3px 2px; border-bottom: 1px dotted #ddd; text-align: right; vertical-align: top; white-space: nowrap;">S/${subtotal.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="border-top: 1px dashed #333; padding-top: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px;">
          <span>Productos:</span>
          <span>S/ ${receipt.totals.productsTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px;">
          <span>IGV 18%:</span>
          <span>S/ ${receipt.totals.taxTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px;">
          <span>Envío:</span>
          <span>S/ ${receipt.totals.shippingTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px solid #333; padding-top: 6px; margin-top: 6px;">
          <span>Total:</span>
          <span>S/ ${receipt.totals.grandTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px;">
          <span>Descuentos:</span>
          <span>S/ ${receipt.totals.discountTotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px;">
          <span>Adelanto:</span>
          <span>S/ ${totalPaid.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; color: #333;">
          <span>Por Cobrar:</span>
          <span>S/ ${pendingAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Prints multiple receipts using the compact 80mm thermal format with QR codes.
 * Opens a new print window and triggers the print dialog.
 * 
 * @param receipts - Array of receipt data to print
 * @returns Promise that resolves when print dialog is triggered, or rejects on error
 */
export async function printReceipts(receipts: ReceiptData[]): Promise<void> {
  if (receipts.length === 0) {
    throw new Error('No receipts to print');
  }

  // Generate QR codes for all receipts in parallel
  const qrPromises = receipts.map(r => generateQR(r.orderId));
  const qrUrls = await Promise.all(qrPromises);

  // Generate HTML for all receipts
  const receiptHTMLs = receipts.map((receipt, index) => 
    generateReceiptHTML(receipt, qrUrls[index], index === receipts.length - 1)
  );

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Impresión de Recibos</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        @media print {
          body { padding: 0; }
          @page { margin: 5mm; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      ${receiptHTMLs.join('')}
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresión. Verifica que los popups no estén bloqueados.');
  }

  printWindow.document.write(printContent);
  printWindow.document.close();

  // Wait for content to load then print
  return new Promise((resolve) => {
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      resolve();
    };
  });
}
