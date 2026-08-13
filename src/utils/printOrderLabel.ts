import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrderHeader } from "@/interfaces/IOrder";

export interface OrderReceipt {
  orderId: string;
  orderNumber: string;
  receiptType?: string;
  status: string;
  createdAt: string;
  salesChannel?: string;
  closingChannel?: string;
  callStatus?: string;
  callAttempts?: number;
  callbackAt?: string | null;
  customer: {
    id?: string;
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
    isPromoItem?: boolean;
    addedByUserId?: string | null;
    addedByUserName?: string | null;
    addedAt?: string | null;
  }[];
  payments: {
    id: string;
    paymentMethod: string;
    amount: number;
    paymentDate: string;
    status: string;
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
  externalTrackingNumber?: string | null;
  shippingCode?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  upsellOffered?: boolean;
  upsellAccepted?: boolean;
  upsellDetails?: string | null;
  externalSource?: string | null;
}

export interface PrintLabelCompany {
  name?: string;
  cuit?: string;
  logoUrl?: string;
  stores?: { id: string; name: string }[];
}

/** Etiqueta de estado para la impresión — vocabulario de despacho, no el enum crudo. */
const PRINT_STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  PENDIENTE: { label: "POR DESPACHAR", bg: "#e0e7ff", color: "#3730a3" },
  PREPARADO: { label: "POR DESPACHAR", bg: "#e0e7ff", color: "#3730a3" },
  LLAMADO: { label: "POR DESPACHAR", bg: "#e0e7ff", color: "#3730a3" },
  ASIGNADO_A_GUIA: { label: "ASIGNADO A GUÍA", bg: "#e0e7ff", color: "#3730a3" },
  EN_ENVIO: { label: "EN CAMINO", bg: "#cffafe", color: "#155e75" },
  ENTREGADO: { label: "ENTREGADO", bg: "#dcfce7", color: "#166534" },
  ANULADO: { label: "ANULADO", bg: "#fee2e2", color: "#991b1b" },
};

export const PRINT_DELIVERY_TYPE_LABEL: Record<string, string> = {
  DOMICILIO: "Envío a domicilio",
  RETIRO_TIENDA: "Retiro en tienda",
};

async function generateQR(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { width: 120 });
  } catch (err) {
    console.error("Error generating QR", err);
    return "";
  }
}

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
 * Arma y abre la etiqueta de despacho (10cm de ancho, alto automático) en una
 * ventana nueva lista para imprimir/guardar como PDF desde el diálogo del
 * navegador. Compartida entre el modal de pedido (Ventas/Operaciones/CC) y el
 * modal de éxito de registro de venta, para que ambos generen exactamente la
 * misma etiqueta en vez de mantener dos plantillas divergentes.
 */
export async function printOrderLabel(
  receipt: OrderReceipt,
  orderHeader: OrderHeader | null,
  company?: PrintLabelCompany | null,
): Promise<void> {
  // El QR apunta al link público de rastreo (mismo que "Copiar link de
  // rastreo" en el modal) — antes codificaba el orderId crudo (un UUID), que
  // al escanearlo solo mostraba texto plano, no información del pedido.
  const trackingUrlForQr = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
  const qrDataUrl = await generateQR(trackingUrlForQr);
  const barcodeDataUrl = generateBarcode(receipt.orderNumber);

  const totalPaid = receipt.totals.totalPaid || 0;
  const pendingAmount = receipt.totals.pendingAmount || 0;

  // "Almacén" = nombre de la tienda del pedido — no existe un concepto de
  // almacén/bodega separado en el sistema hoy, es el dato más cercano.
  const storeName = company?.stores?.find((s) => s.id === orderHeader?.storeId)?.name;
  const rawStatus = orderHeader?.status ?? receipt.status;
  const statusInfo = PRINT_STATUS_LABEL[rawStatus] ?? {
    label: rawStatus,
    bg: "#f1f5f9",
    color: "#334155",
  };
  const deliveryLabel =
    PRINT_DELIVERY_TYPE_LABEL[orderHeader?.deliveryType ?? ""] ??
    orderHeader?.deliveryType ??
    "-";
  const paymentMethods =
    Array.from(new Set(receipt.payments.map((p) => p.paymentMethod))).join(" / ") || "-";
  const totalUnidades = receipt.items.reduce((s, it) => s + it.quantity, 0);
  const fmtShort = (d: string | Date) => format(new Date(d), "dd/MM/yy");

  const printWindow = window.open("", "_blank", "width=420,height=750");
  if (!printWindow) {
    toast.error("No se pudo abrir la ventana de impresión");
    return;
  }

  const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Etiqueta - ${receipt.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            padding: 14px;
            max-width: 380px;
            margin: 0 auto;
            color: #111;
          }
          .company-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding-bottom: 10px;
            border-bottom: 2px solid #111;
            margin-bottom: 10px;
          }
          .logo-box {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            background: #1f2937;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: bold;
            flex-shrink: 0;
            overflow: hidden;
          }
          .logo-box img { width: 100%; height: 100%; object-fit: contain; }
          .company-name { font-size: 16px; font-weight: bold; }
          .company-meta { font-size: 10px; color: #333; font-weight: 500; margin-top: 2px; }

          .order-block {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 8px;
          }
          .order-qr { width: 72px; height: 72px; flex-shrink: 0; }
          .order-number { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
          .order-dates { font-size: 10px; color: #222; font-weight: 500; margin-top: 3px; display: flex; gap: 10px; }
          .order-dates b { color: #111; }
          .status-badge {
            display: inline-block;
            margin-top: 5px;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: bold;
            background: ${statusInfo.bg};
            color: ${statusInfo.color};
          }

          .barcode-wrap { text-align: center; margin: 8px 0 10px; padding-bottom: 8px; border-bottom: 1px dashed #999; }
          .barcode-wrap img { max-width: 100%; height: 48px; }

          .cod-banner {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #111;
            color: #fff;
            padding: 8px 10px;
            border-radius: 6px;
            margin-bottom: 10px;
          }
          .cod-banner .cod-label { font-size: 10px; font-weight: bold; text-transform: uppercase; line-height: 1.4; }
          .cod-banner .cod-amount { font-size: 20px; font-weight: bold; white-space: nowrap; }
          .paid-banner {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #dcfce7;
            color: #166534;
            padding: 8px 10px;
            border-radius: 6px;
            margin-bottom: 10px;
            font-size: 11px;
            font-weight: bold;
          }

          .info-row { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc; }
          .customer-info { font-size: 10.5px; line-height: 1.55; }
          .customer-info b { font-weight: 600; }
          .location-info { text-align: right; font-size: 10px; flex-shrink: 0; }
          .district-pill {
            display: inline-block;
            background: #fef3c7;
            color: #92400e;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10.5px;
            margin-bottom: 3px;
          }
          .location-info div { color: #222; font-weight: 500; }

          .courier-row {
            display: flex;
            justify-content: space-between;
            font-size: 10.5px;
            padding: 6px 0;
            border-bottom: 1px dashed #ccc;
            margin-bottom: 8px;
          }
          .courier-row b { font-weight: bold; }

          .picking-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 6px;
          }
          .picking-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          .picking-almacen { font-size: 9.5px; color: #333; font-weight: 500; text-align: right; }

          .pick-item { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-bottom: 1px dotted #ddd; }
          .pick-checkbox { width: 14px; height: 14px; border: 1.5px solid #333; border-radius: 2px; margin-top: 2px; flex-shrink: 0; }
          .pick-qty { text-align: center; width: 26px; flex-shrink: 0; }
          .pick-qty .num { font-size: 15px; font-weight: bold; line-height: 1; }
          .pick-qty .unit { font-size: 8px; color: #333; font-weight: 500; }
          .pick-body { flex: 1; min-width: 0; }
          .pick-name { font-weight: bold; font-size: 11px; }
          .pick-meta { font-size: 9px; color: #333; font-weight: 500; margin-top: 1px; }
          .pick-price { font-size: 11px; font-weight: 600; white-space: nowrap; }
          .pick-summary { font-size: 9.5px; color: #333; font-weight: 500; margin-top: 6px; }

          .totals { margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; font-size: 10.5px; }
          .totals-line { color: #222; font-weight: 500; margin-bottom: 4px; }
          .total-main { display: flex; justify-content: space-between; align-items: baseline; }
          .total-main .label { font-size: 14px; font-weight: bold; }
          .total-main .value { font-size: 18px; font-weight: bold; }
          .advance-line { display: flex; justify-content: space-between; font-size: 10px; color: #222; font-weight: 500; margin-top: 3px; }

          .tracking-section {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #333;
            font-size: 10px;
          }
          .tracking-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
          .tracking-item { line-height: 1.2; }
          .tracking-label { color: #333; font-weight: 600; font-size: 8px; text-decoration: underline; }
          .tracking-value { font-weight: bold; display: block; }

          @media print {
            body { padding: 8px; }
            @page { margin: 5mm; size: 100mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="company-header">
          <div class="logo-box">
            ${company?.logoUrl ? `<img src="${company.logoUrl}" alt="Logo">` : "LOGO"}
          </div>
          <div>
            <div class="company-name">${company?.name ?? "-"}</div>
            ${company?.cuit ? `<div class="company-meta">RUC ${company.cuit}</div>` : ""}
          </div>
        </div>

        <div class="order-block">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="order-qr">` : ""}
          <div>
            <div class="order-number">${receipt.orderNumber}</div>
            <div class="order-dates">
              <span>Creado: <b>${fmtShort(receipt.createdAt)}</b></span>
              ${orderHeader?.callbackAt ? `<span>Entrega: <b>${fmtShort(orderHeader.callbackAt)}</b></span>` : ""}
            </div>
            <div class="status-badge">${statusInfo.label}</div>
          </div>
        </div>

        ${barcodeDataUrl ? `<div class="barcode-wrap"><img src="${barcodeDataUrl}" alt="Código de barras"></div>` : ""}

        ${
          pendingAmount > 0
            ? `
        <div class="cod-banner">
          <div class="cod-label">Por cobrar contra entrega<br/>Pago: ${paymentMethods}</div>
          <div class="cod-amount">S/ ${pendingAmount.toFixed(2)}</div>
        </div>`
            : `
        <div class="paid-banner">
          <span>✓ Pagado</span>
          <span>S/ ${receipt.totals.grandTotal.toFixed(2)}</span>
        </div>`
        }

        <div class="info-row">
          <div class="customer-info">
            <div><b>Cliente:</b> ${receipt.customer.fullName}</div>
            <div><b>Tel:</b> ${receipt.customer.phoneNumber || "-"} · <b>DNI:</b> ${receipt.customer.dni || "-"}</div>
            <div><b>Dir:</b> ${receipt.customer.address || "-"}</div>
            ${receipt.customer.reference ? `<div><b>Ref:</b> ${receipt.customer.reference}</div>` : ""}
          </div>
          <div class="location-info">
            ${receipt.customer.district ? `<div class="district-pill">${receipt.customer.district}</div>` : ""}
            <div>${receipt.customer.city || "-"}</div>
            <div>Prov. ${receipt.customer.province || "-"}</div>
            <div>Canal: ${receipt.salesChannel || "-"}</div>
          </div>
        </div>

        <div class="courier-row">
          <span><b>Courier:</b> ${orderHeader?.courier || "-"}</span>
          <span>${deliveryLabel}</span>
        </div>

        <div class="picking-header">
          <div class="picking-title">Preparar / Picking</div>
          ${storeName ? `<div class="picking-almacen">Almacén<br/><b>${storeName}</b></div>` : ""}
        </div>

        ${receipt.items
          .map((item) => {
            const attrs = item.attributes
              ? Object.values(item.attributes).join(" / ")
              : "";
            return `
          <div class="pick-item">
            <div class="pick-checkbox"></div>
            <div class="pick-qty">
              <div class="num">${item.quantity}</div>
              <div class="unit">und</div>
            </div>
            <div class="pick-body">
              <div class="pick-name">${item.productName}</div>
              <div class="pick-meta">${attrs ? `${attrs} · ` : ""}${item.sku ? `SKU: ${item.sku}` : ""}</div>
            </div>
            <div class="pick-price">S/ ${Number(item.subtotal).toFixed(2)}</div>
          </div>`;
          })
          .join("")}

        <div class="pick-summary">Total a preparar: ${receipt.items.length} ítem${receipt.items.length === 1 ? "" : "s"} · ${totalUnidades} unidad${totalUnidades === 1 ? "" : "es"}</div>

        <div class="totals">
          <div class="totals-line">
            Productos S/ ${receipt.totals.productsTotal.toFixed(2)} · IGV 18% S/ ${receipt.totals.taxTotal.toFixed(2)} · Envío S/ ${receipt.totals.shippingTotal.toFixed(2)} · Desc S/ ${receipt.totals.discountTotal.toFixed(2)}
          </div>
          <div class="total-main">
            <span class="label">Total</span>
            <span class="value">S/ ${receipt.totals.grandTotal.toFixed(2)}</span>
          </div>
          ${
            totalPaid > 0
              ? `<div class="advance-line"><span>Adelanto pagado</span><span>- S/ ${totalPaid.toFixed(2)}</span></div>`
              : ""
          }
        </div>

        ${
          receipt.externalTrackingNumber ||
          receipt.shippingCode ||
          receipt.shippingKey ||
          receipt.shippingOffice
            ? `
        <div class="tracking-section">
          <div class="tracking-grid">
            ${
              receipt.externalTrackingNumber
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Tracking:</span>
              <span class="tracking-value">${receipt.externalTrackingNumber}</span>
            </div>`
                : ""
            }
            ${
              receipt.shippingOffice
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Oficina:</span>
              <span class="tracking-value">${receipt.shippingOffice}</span>
            </div>`
                : ""
            }
            ${
              receipt.shippingCode
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Código:</span>
              <span class="tracking-value">${receipt.shippingCode}</span>
            </div>`
                : ""
            }
            ${
              receipt.shippingKey
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Clave:</span>
              <span class="tracking-value">${
                pendingAmount > 0
                  ? '<span style="color:red; font-weight:bold;">CLAVE OCULTA (Pago Pendiente)</span>'
                  : receipt.shippingKey
              }</span>
            </div>`
                : ""
            }
          </div>
        </div>
        `
            : ""
        }
      </body>
      </html>
    `;

  printWindow.document.write(printContent);
  printWindow.document.close();

  // Esperar a que cargue el contenido y el QR antes de imprimir
  await new Promise<void>((resolve) => {
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      resolve();
    };
  });
}
