import QRCode from "qrcode";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import {
  OrderReceipt,
  PrintLabelCompany,
  PRINT_DELIVERY_TYPE_LABEL,
} from "@/utils/printOrderLabel";

/** Color del badge de estado en el comprobante PDF — por estado real (no agrupado como en la etiqueta). */
const PDF_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDIENTE: { bg: "#fef3c7", color: "#92400e" },
  PREPARADO: { bg: "#e0e7ff", color: "#3730a3" },
  LLAMADO: { bg: "#ede9fe", color: "#5b21b6" },
  ASIGNADO_A_GUIA: { bg: "#e0e7ff", color: "#3730a3" },
  EN_ENVIO: { bg: "#cffafe", color: "#155e75" },
  ENTREGADO: { bg: "#dcfce7", color: "#166534" },
  ANULADO: { bg: "#fee2e2", color: "#991b1b" },
  PAGADO: { bg: "#ccfbf1", color: "#115e59" },
};

/** "META_ADS" → "Meta Ads" — para no mostrar el enum crudo en canal/método de pago. */
function toTitleCase(value?: string | null): string {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function generateQR(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { width: 120 });
  } catch (err) {
    console.error("Error generating QR", err);
    return "";
  }
}

/**
 * Genera y descarga el PDF de la Nota de venta (documento interno, no
 * comprobante SUNAT). Compartido entre el modal de pedido (CustomerServiceModal)
 * y el modal de éxito de registro de venta para evitar plantillas divergentes.
 */
export async function downloadNotaVentaPdf(
  receipt: OrderReceipt,
  orderHeader: OrderHeader | null,
  company?: PrintLabelCompany | null,
): Promise<void> {
  const trackingUrlForQr = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
  const qrDataUrl = await generateQR(trackingUrlForQr);

  const totalPaid = receipt.totals.totalPaid || 0;
  const pendingAmount = receipt.totals.pendingAmount || 0;

  const rawStatus = orderHeader?.status ?? receipt.status;
  const statusColor = PDF_STATUS_COLOR[rawStatus] ?? { bg: "#f1f5f9", color: "#334155" };
  const statusLabel = getStatusLabel(rawStatus as OrderStatus).toUpperCase();
  const deliveryLabel =
    PRINT_DELIVERY_TYPE_LABEL[orderHeader?.deliveryType ?? ""] ??
    orderHeader?.deliveryType ??
    "-";
  const paymentMethods =
    Array.from(new Set(receipt.payments.map((p) => toTitleCase(p.paymentMethod)))).join(" / ") ||
    "-";
  const emitido = format(new Date(receipt.createdAt), "dd/MM/yyyy · HH:mm");
  const direccion = [
    receipt.customer.address,
    receipt.customer.district,
    receipt.customer.province ? `${receipt.customer.city || ""} - ${receipt.customer.province}` : receipt.customer.city,
  ]
    .filter(Boolean)
    .join(" · ");

  const pdfHtml = `
    <div id="pdf-comprobante-root">
      <style>
        #pdf-comprobante-root { font-family: Arial, sans-serif; color: #111; padding: 32px; background: #fff; }
        #pdf-comprobante-root .head-row { display: flex; justify-content: space-between; align-items: flex-start; }
        #pdf-comprobante-root .company { display: flex; gap: 14px; align-items: center; }
        #pdf-comprobante-root .logo-box {
          width: 56px; height: 56px; border-radius: 10px; background: #0f766e; color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; overflow: hidden;
        }
        #pdf-comprobante-root .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        #pdf-comprobante-root .company-name { font-size: 22px; font-weight: bold; }
        #pdf-comprobante-root .company-meta { font-size: 11px; color: #666; margin-top: 3px; }
        #pdf-comprobante-root .doc-info { text-align: right; }
        #pdf-comprobante-root .doc-badge {
          display: inline-block; background: #d1fae5; color: #065f46; font-size: 10px; font-weight: bold;
          letter-spacing: 0.5px; padding: 4px 10px; border-radius: 4px;
        }
        #pdf-comprobante-root .doc-title { font-size: 22px; font-weight: bold; margin-top: 6px; }
        #pdf-comprobante-root .doc-order { font-size: 12px; color: #555; margin-top: 2px; }
        #pdf-comprobante-root .divider { height: 3px; background: #0f766e; margin: 18px 0; border-radius: 2px; }
        #pdf-comprobante-root .summary-row { display: flex; gap: 26px; align-items: flex-start; margin-bottom: 22px; }
        #pdf-comprobante-root .summary-qr { width: 96px; height: 96px; flex-shrink: 0; }
        #pdf-comprobante-root .summary-grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 20px; }
        #pdf-comprobante-root .summary-label { font-size: 9.5px; font-weight: bold; color: #888; letter-spacing: 0.4px; margin-bottom: 3px; }
        #pdf-comprobante-root .summary-value { font-size: 13px; font-weight: 600; }
        #pdf-comprobante-root .status-badge {
          display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;
          background: ${statusColor.bg}; color: ${statusColor.color};
        }
        #pdf-comprobante-root .customer-box { background: #f8fafc; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; }
        #pdf-comprobante-root .customer-title { font-size: 11px; font-weight: bold; color: #0f766e; letter-spacing: 0.5px; margin-bottom: 10px; }
        #pdf-comprobante-root .customer-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 12px 20px; }
        #pdf-comprobante-root .customer-grid .full { grid-column: 1 / -1; }
        #pdf-comprobante-root table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        #pdf-comprobante-root table.items thead tr { background: #111827; color: #fff; }
        #pdf-comprobante-root table.items th { text-align: left; font-size: 10px; letter-spacing: 0.4px; padding: 9px 10px; }
        #pdf-comprobante-root table.items th.num, #pdf-comprobante-root table.items td.num { text-align: right; }
        #pdf-comprobante-root table.items td { padding: 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        #pdf-comprobante-root .attr-pill {
          display: inline-block; background: #f1f5f9; color: #475569; font-size: 9.5px; font-weight: 600;
          padding: 2px 8px; border-radius: 4px; margin: 2px 4px 0 0;
        }
        #pdf-comprobante-root .totals { width: 320px; margin-left: auto; }
        #pdf-comprobante-root .totals-line { display: flex; justify-content: space-between; font-size: 12px; color: #444; padding: 3px 0; }
        #pdf-comprobante-root .totals-line b { color: #111; font-weight: 600; }
        #pdf-comprobante-root .total-main {
          display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #111;
          margin-top: 8px; padding-top: 10px;
        }
        #pdf-comprobante-root .total-main .label { font-size: 16px; font-weight: bold; }
        #pdf-comprobante-root .total-main .value { font-size: 24px; font-weight: bold; }
        #pdf-comprobante-root .advance-line { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-top: 6px; }
        #pdf-comprobante-root .due-box {
          display: flex; justify-content: space-between; align-items: center; margin-top: 14px;
          padding: 12px 16px; border-radius: 8px; background: #fef3c7; color: #92400e;
        }
        #pdf-comprobante-root .due-box.paid { background: #dcfce7; color: #166534; }
        #pdf-comprobante-root .due-box .label { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; }
        #pdf-comprobante-root .due-box .value { font-size: 20px; font-weight: bold; }
        #pdf-comprobante-root .footer { text-align: center; font-size: 10px; color: #888; margin-top: 30px; line-height: 1.6; }
      </style>

      <div class="head-row">
        <div class="company">
          <div class="logo-box">${company?.logoUrl ? `<img src="${company.logoUrl}" alt="Logo">` : "LOGO"}</div>
          <div>
            <div class="company-name">${company?.name ?? "-"}</div>
            <div class="company-meta">${[
              company?.cuit ? `RUC ${company.cuit}` : null,
              company?.billingAddress || null,
            ]
              .filter(Boolean)
              .join(" · ")}</div>
          </div>
        </div>
        <div class="doc-info">
          <span class="doc-badge">COMPROBANTE · ${(receipt.receiptType || "BOLETA").toUpperCase()}</span>
          <div class="doc-title">Nota de venta</div>
          <div class="doc-order">N° Orden: ${receipt.orderNumber}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="summary-row">
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="summary-qr">` : ""}
        <div class="summary-grid">
          <div>
            <div class="summary-label">ESTADO</div>
            <span class="status-badge">${statusLabel}</span>
          </div>
          <div>
            <div class="summary-label">FECHA DE EMISIÓN</div>
            <div class="summary-value">${emitido}</div>
          </div>
          <div>
            <div class="summary-label">CANAL</div>
            <div class="summary-value">${toTitleCase(receipt.salesChannel)}</div>
          </div>
          <div>
            <div class="summary-label">TIPO DE ENTREGA</div>
            <div class="summary-value">${deliveryLabel}</div>
          </div>
          <div>
            <div class="summary-label">COURIER</div>
            <div class="summary-value">${orderHeader?.courier || "-"}</div>
          </div>
          <div>
            <div class="summary-label">MÉTODO DE PAGO</div>
            <div class="summary-value">${paymentMethods}</div>
          </div>
        </div>
      </div>

      <div class="customer-box">
        <div class="customer-title">DATOS DEL CLIENTE</div>
        <div class="customer-grid">
          <div>
            <div class="summary-label">NOMBRE</div>
            <div class="summary-value">${receipt.customer.fullName}</div>
          </div>
          <div>
            <div class="summary-label">TELÉFONO</div>
            <div class="summary-value">${receipt.customer.phoneNumber || "-"}</div>
          </div>
          <div>
            <div class="summary-label">DNI</div>
            <div class="summary-value">${receipt.customer.dni || "-"}</div>
          </div>
          <div class="full">
            <div class="summary-label">DIRECCIÓN</div>
            <div class="summary-value">${direccion || "-"}</div>
          </div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Variantes</th>
            <th class="num">Cantidad</th>
            <th class="num">P. Unitario</th>
            <th class="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items
            .map(
              (item: any) => `
            <tr>
              <td><b>${item.productName}</b></td>
              <td>${
                item.attributes
                  ? Object.entries(item.attributes)
                      .map(([k, v]) => `<span class="attr-pill">${k}: ${v}</span>`)
                      .join("")
                  : "-"
              }</td>
              <td class="num">${item.quantity}</td>
              <td class="num">S/ ${Number(item.unitPrice).toFixed(2)}</td>
              <td class="num">S/ ${Number(item.subtotal).toFixed(2)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-line"><span>Productos</span><b>S/ ${receipt.totals.productsTotal.toFixed(2)}</b></div>
        <div class="totals-line"><span>IGV 18%</span><b>S/ ${receipt.totals.taxTotal.toFixed(2)}</b></div>
        <div class="totals-line"><span>Envío</span><b>S/ ${receipt.totals.shippingTotal.toFixed(2)}</b></div>
        <div class="totals-line"><span>Descuentos</span><b>S/ ${receipt.totals.discountTotal.toFixed(2)}</b></div>
        <div class="total-main"><span class="label">Total</span><span class="value">S/ ${receipt.totals.grandTotal.toFixed(2)}</span></div>
        ${
          totalPaid > 0
            ? `<div class="advance-line"><span>Adelanto pagado</span><span>– S/ ${totalPaid.toFixed(2)}</span></div>`
            : ""
        }
        ${
          pendingAmount > 0
            ? `<div class="due-box"><span class="label">POR COBRAR</span><span class="value">S/ ${pendingAmount.toFixed(2)}</span></div>`
            : `<div class="due-box paid"><span class="label">PAGADO</span><span class="value">S/ ${receipt.totals.grandTotal.toFixed(2)}</span></div>`
        }
      </div>

      <div class="footer">
        Documento interno de venta generado por POWIP · No constituye comprobante electrónico SUNAT.<br>
        Gracias por tu compra.
      </div>
    </div>
  `;

  // Se renderiza en un <iframe> aislado (propio document en blanco) porque
  // esta app usa Tailwind 4, cuyas variables de color están en oklch() —
  // html2canvas no sabe parsearlas si hereda el CSS de la página real.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "1200px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    if (!idoc) throw new Error("No se pudo preparar el documento del comprobante");
    idoc.open();
    idoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;">${pdfHtml}</body></html>`);
    idoc.close();

    await new Promise((resolve) => setTimeout(resolve, 50));
    const target = idoc.getElementById("pdf-comprobante-root") ?? idoc.body;

    // html2canvas-pro (fork que sí soporta lab()/oklch()) en vez del
    // html2canvas estándar que trae html2pdf.js.
    const canvas = await html2canvas(target as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);
    pdf.save(`Comprobante_${receipt.orderNumber}.pdf`);
  } catch (err) {
    console.error("Error generando comprobante PDF", err);
    toast.error("No se pudo generar el comprobante");
  } finally {
    document.body.removeChild(iframe);
  }
}
