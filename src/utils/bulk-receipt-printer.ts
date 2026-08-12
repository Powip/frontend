import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

/**
 * Receipt data structure matching the backend's OrderReceipt format
 * (mismo endpoint /order-header/:id/receipt que usa CustomerServiceModal —
 * ver `OrderReceipt` ahí; acá solo se declaran los campos que este template
 * usa, aunque la respuesta real trae más).
 */
export interface ReceiptData {
  orderId: string;
  orderNumber: string;
  receiptType?: string;
  status?: string;
  createdAt?: string;
  callbackAt?: string | null;
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
  payments?: { paymentMethod: string }[];
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

/** Datos de empresa para el header de cada etiqueta — mismo shape que `auth.company`. */
export interface PrintCompany {
  name?: string;
  cuit?: string;
  logoUrl?: string;
}

/** Etiqueta de estado — mismo vocabulario de despacho que CustomerServiceModal. */
const PRINT_STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  PENDIENTE: { label: "POR DESPACHAR", bg: "#e0e7ff", color: "#3730a3" },
  PREPARADO: { label: "POR DESPACHAR", bg: "#e0e7ff", color: "#3730a3" },
  LLAMADO: { label: "POR DESPACHAR", bg: "#e0e7ff", color: "#3730a3" },
  ASIGNADO_A_GUIA: { label: "ASIGNADO A GUÍA", bg: "#e0e7ff", color: "#3730a3" },
  EN_ENVIO: { label: "EN CAMINO", bg: "#cffafe", color: "#155e75" },
  ENTREGADO: { label: "ENTREGADO", bg: "#dcfce7", color: "#166534" },
  ANULADO: { label: "ANULADO", bg: "#fee2e2", color: "#991b1b" },
};

function fmtShort(d: string | Date): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
}

/** Generates a QR code data URL from text */
async function generateQR(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { width: 120 });
  } catch (err) {
    console.error("Error generating QR", err);
    return "";
  }
}

/** Generates a CODE128 barcode data URL — mismo formato que usa el escáner de Operaciones. */
function generateBarcode(text: string): string {
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, text, {
      format: "CODE128",
      width: 2,
      height: 40,
      displayValue: true,
      fontSize: 12,
      margin: 0,
    });
    return canvas.toDataURL();
  } catch (err) {
    console.error("Error generating barcode", err);
    return "";
  }
}

/**
 * Generates HTML for a single receipt — mismo diseño de etiqueta de
 * despacho/picking que el botón "Imprimir" de CustomerServiceModal (logo,
 * QR al link público de rastreo, código de barras, banner de cobro contra
 * entrega, datos de cliente/ubicación, checklist de picking, totales).
 *
 * No incluye Courier ni Almacén: a diferencia del modal de un solo pedido
 * (que tiene el OrderHeader completo), acá los 3 puntos que imprimen en
 * lote (Pedidos/Ventas/Finanzas) no siempre tienen esos datos ya cargados
 * sin pedirlos aparte — se dejan afuera para no duplicar llamadas de red
 * por cada pedido seleccionado.
 */
function generateReceiptHTML(
  receipt: ReceiptData,
  qrDataUrl: string,
  barcodeDataUrl: string,
  company: PrintCompany | null | undefined,
  isLast: boolean,
): string {
  const totalPaid = receipt.totals.totalPaid || 0;
  const pendingAmount = receipt.totals.pendingAmount || 0;
  const statusInfo = receipt.status
    ? (PRINT_STATUS_LABEL[receipt.status] ?? { label: receipt.status, bg: "#f1f5f9", color: "#334155" })
    : null;
  const paymentMethods =
    Array.from(new Set((receipt.payments ?? []).map((p) => p.paymentMethod))).join(" / ") || "-";

  return `
    <div style="page-break-after: ${isLast ? "auto" : "always"}; max-width: 380px; margin: 0 auto; font-family: Arial, sans-serif; font-size: 12px; padding: 14px; color: #111;">
      <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 2px solid #111; margin-bottom: 10px;">
        <div style="width: 48px; height: 48px; border-radius: 8px; background: #1f2937; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; flex-shrink: 0; overflow: hidden;">
          ${company?.logoUrl ? `<img src="${company.logoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">` : "LOGO"}
        </div>
        <div>
          <div style="font-size: 16px; font-weight: bold;">${company?.name ?? "-"}</div>
          ${company?.cuit ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">RUC ${company.cuit}</div>` : ""}
        </div>
      </div>

      <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px;">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width: 72px; height: 72px; flex-shrink: 0;">` : ""}
        <div>
          <div style="font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">${receipt.orderNumber}</div>
          <div style="font-size: 10px; color: #444; margin-top: 3px; display: flex; gap: 10px;">
            ${receipt.createdAt ? `<span>Creado: <b style="color:#111;">${fmtShort(receipt.createdAt)}</b></span>` : ""}
            ${receipt.callbackAt ? `<span>Entrega: <b style="color:#111;">${fmtShort(receipt.callbackAt)}</b></span>` : ""}
          </div>
          ${
            statusInfo
              ? `<div style="display: inline-block; margin-top: 5px; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; background: ${statusInfo.bg}; color: ${statusInfo.color};">${statusInfo.label}</div>`
              : ""
          }
        </div>
      </div>

      ${
        barcodeDataUrl
          ? `<div style="text-align: center; margin: 8px 0 10px; padding-bottom: 8px; border-bottom: 1px dashed #999;"><img src="${barcodeDataUrl}" alt="Código de barras" style="max-width: 100%; height: 48px;"></div>`
          : ""
      }

      ${
        pendingAmount > 0
          ? `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #111; color: #fff; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
        <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; line-height: 1.4;">Por cobrar contra entrega<br/>Pago: ${paymentMethods}</div>
        <div style="font-size: 20px; font-weight: bold; white-space: nowrap;">S/ ${pendingAmount.toFixed(2)}</div>
      </div>`
          : `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #dcfce7; color: #166534; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; font-weight: bold;">
        <span>✓ Pagado</span>
        <span>S/ ${receipt.totals.grandTotal.toFixed(2)}</span>
      </div>`
      }

      <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
        <div style="font-size: 10.5px; line-height: 1.55;">
          <div><b>Cliente:</b> ${receipt.customer.fullName}</div>
          <div><b>Tel:</b> ${receipt.customer.phoneNumber || "-"} · <b>DNI:</b> ${receipt.customer.dni || "-"}</div>
          <div><b>Dir:</b> ${receipt.customer.address || "-"}</div>
          ${receipt.customer.reference ? `<div><b>Ref:</b> ${receipt.customer.reference}</div>` : ""}
        </div>
        <div style="text-align: right; font-size: 10px; flex-shrink: 0;">
          ${receipt.customer.district ? `<div style="display: inline-block; background: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 10.5px; margin-bottom: 3px;">${receipt.customer.district}</div>` : ""}
          <div style="color: #555;">${receipt.customer.city || "-"}</div>
          <div style="color: #555;">Prov. ${receipt.customer.province || "-"}</div>
          <div style="color: #555;">Canal: ${receipt.salesChannel || "-"}</div>
        </div>
      </div>

      <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Preparar / Picking</div>

      ${receipt.items
        .map((item) => {
          const attrs = item.attributes ? Object.values(item.attributes).join(" / ") : "";
          return `
        <div style="display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-bottom: 1px dotted #ddd;">
          <div style="width: 14px; height: 14px; border: 1.5px solid #333; border-radius: 2px; margin-top: 2px; flex-shrink: 0;"></div>
          <div style="text-align: center; width: 26px; flex-shrink: 0;">
            <div style="font-size: 15px; font-weight: bold; line-height: 1;">${item.quantity}</div>
            <div style="font-size: 8px; color: #666;">und</div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: bold; font-size: 11px;">${item.productName}</div>
            <div style="font-size: 9px; color: #666; margin-top: 1px;">${attrs ? `${attrs} · ` : ""}${item.sku ? `SKU: ${item.sku}` : ""}</div>
          </div>
          <div style="font-size: 11px; font-weight: 600; white-space: nowrap;">S/ ${Number(item.subtotal).toFixed(2)}</div>
        </div>`;
        })
        .join("")}

      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; font-size: 10.5px;">
        <div style="color: #555; margin-bottom: 4px;">
          Productos S/ ${receipt.totals.productsTotal.toFixed(2)} · IGV 18% S/ ${receipt.totals.taxTotal.toFixed(2)} · Envío S/ ${receipt.totals.shippingTotal.toFixed(2)} · Desc S/ ${receipt.totals.discountTotal.toFixed(2)}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 14px; font-weight: bold;">Total</span>
          <span style="font-size: 18px; font-weight: bold;">S/ ${receipt.totals.grandTotal.toFixed(2)}</span>
        </div>
        ${
          totalPaid > 0
            ? `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 3px;"><span>Adelanto pagado</span><span>- S/ ${totalPaid.toFixed(2)}</span></div>`
            : ""
        }
      </div>
    </div>
  `;
}

/**
 * Prints multiple receipts using the label format (logo, QR de rastreo,
 * código de barras, banner de cobro/pago, checklist de picking) — mismo
 * diseño que el botón "Imprimir" de un solo pedido (CustomerServiceModal),
 * uno por página. Abre una ventana nueva y dispara el diálogo de impresión.
 *
 * @param receipts - Array of receipt data to print
 * @param company - Datos de la empresa (auth.company) para el header — opcional.
 * @returns Promise that resolves when print dialog is triggered, or rejects on error
 */
export async function printReceipts(
  receipts: ReceiptData[],
  company?: PrintCompany | null,
): Promise<void> {
  if (receipts.length === 0) {
    throw new Error("No receipts to print");
  }

  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL;

  // Genera QR (link público de rastreo, no el orderId crudo) y código de
  // barras (N° de pedido) para todos los recibos en paralelo.
  const qrPromises = receipts.map((r) => generateQR(`${landingUrl}/rastreo/${r.orderNumber}`));
  const qrUrls = await Promise.all(qrPromises);
  const barcodeUrls = receipts.map((r) => generateBarcode(r.orderNumber));

  const receiptHTMLs = receipts.map((receipt, index) =>
    generateReceiptHTML(
      receipt,
      qrUrls[index],
      barcodeUrls[index],
      company,
      index === receipts.length - 1,
    ),
  );

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Impresión de Etiquetas</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        @media print {
          body { padding: 0; }
          @page { margin: 5mm; size: 100mm auto; }
        }
      </style>
    </head>
    <body>
      ${receiptHTMLs.join("")}
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open("", "_blank", "width=420,height=750");
  if (!printWindow) {
    throw new Error(
      "No se pudo abrir la ventana de impresión. Verifica que los popups no estén bloqueados.",
    );
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
