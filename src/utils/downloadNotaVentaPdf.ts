import { format } from "date-fns";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { toast } from "sonner";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { getStatusLabel } from "@/utils/domain/orders-status-flow";
import {
  type OrderReceipt,
  PRINT_DELIVERY_TYPE_LABEL,
  type PrintLabelCompany,
} from "@/utils/printOrderLabel";
import {
  escapePrintHtml,
  getPrintableUnitCodes,
  type PrintDocumentOptions,
} from "@/utils/receiptUnitCodes";

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

async function generateQR(text: string, isCurrent: () => boolean): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { width: 120 });
  } catch (err) {
    if (isCurrent()) console.error("Error generating QR", err);
    return "";
  }
}

/**
 * Genera y descarga el PDF de la Nota de venta (documento interno, no
 * comprobante SUNAT). Compartido entre el modal de pedido (CustomerServiceModal)
 * y el modal de éxito de registro de venta para evitar plantillas divergentes.
 */
export function buildNotaVentaHtml(
  receipt: OrderReceipt,
  orderHeader: OrderHeader | null,
  company?: PrintLabelCompany | null,
  qrDataUrl = "",
): string {
  // `receipt.totals.totalPaid` solo suma pagos APROBADOS (status PAID) — un
  // adelanto recién registrado que todavía está PENDING de aprobación por
  // finanzas queda en 0 ahí, y el documento mostraba "Por cobrar" el total
  // completo como si el adelanto nunca se hubiera aplicado. Se recalcula
  // sumando `receipt.payments` sin filtrar por status (mismo criterio que ya
  // usa la vista en pantalla del modal de éxito, OrderReceiptView).
  const totalPaid = receipt.payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const pendingAmount = Math.max(receipt.totals.grandTotal - totalPaid, 0);

  const hasTrackedItems = receipt.items.some(
    (item) => item.trackingMode === "SERIAL" || item.trackingMode === "IMEI",
  );
  // Codes and status must describe the same transactional receipt snapshot.
  const rawStatus = hasTrackedItems ? receipt.status : (orderHeader?.status ?? receipt.status);
  const statusColor = PDF_STATUS_COLOR[rawStatus] ?? { bg: "#f1f5f9", color: "#334155" };
  const statusLabel = getStatusLabel(rawStatus as OrderStatus).toUpperCase();
  const deliveryLabel = receipt.delivery
    ? receipt.delivery.type === "AGENCY" ? "Retiro en agencia" : "Envío a domicilio"
    : PRINT_DELIVERY_TYPE_LABEL[orderHeader?.deliveryType ?? ""] ?? orderHeader?.deliveryType ?? "-";
  const paymentMethods =
    Array.from(new Set(receipt.payments.map((p) => toTitleCase(p.paymentMethod)))).join(" / ") ||
    "-";
  const emitido = format(new Date(receipt.createdAt), "dd/MM/yyyy · HH:mm");
  const destination = receipt.delivery ? {
    address: receipt.delivery.address, district: receipt.delivery.district,
    city: receipt.delivery.department, province: receipt.delivery.province,
  } : receipt.customer;
  const direccion = [
    destination.address,
    destination.district,
    destination.province
      ? `${destination.city || ""} - ${destination.province}`
      : destination.city,
  ]
    .filter(Boolean)
    .join(" · ");

  const pdfHtml = `
    <div id="pdf-comprobante-root" data-order-number="${escapePrintHtml(receipt.orderNumber)}">
      <style>
        #pdf-comprobante-root { font-family: Arial, sans-serif; color: #111; width: 800px; background: #fff; }
        #pdf-comprobante-root * { box-sizing: border-box; }
        #pdf-comprobante-root .nota-venta-page { position: relative; width: 800px; padding: 32px 32px 40px; background: #fff; }
        #pdf-comprobante-root .nota-venta-content { display: flow-root; overflow-wrap: anywhere; }
        #pdf-comprobante-root .page-heading { font-size: 12px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 14px; }
        #pdf-comprobante-root .page-number { position: absolute; bottom: 12px; left: 32px; right: 32px; font-size: 9px; text-align: right; color: #666; }
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
        #pdf-comprobante-root table.items { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 20px; }
        #pdf-comprobante-root table.items thead tr { background: #111827; color: #fff; }
        #pdf-comprobante-root table.items th { text-align: left; font-size: 10px; letter-spacing: 0.4px; padding: 9px 10px; }
        #pdf-comprobante-root table.items th.num, #pdf-comprobante-root table.items td.num { text-align: right; }
        #pdf-comprobante-root table.items td { padding: 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        #pdf-comprobante-root table.items tr.unit-row td { padding: 3px 10px 5px; font-size: 11px; }
        #pdf-comprobante-root .unit-code { font-family: monospace; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
        #pdf-comprobante-root .unit-notice { font-size: 11px; color: #555; }
        #pdf-comprobante-root .item-continuation td { background: #f8fafc; font-size: 11px; }
        #pdf-comprobante-root .closing { display: flow-root; }
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

      <div class="nota-venta-page" data-pdf-source>
      <div class="head-row">
        <div class="company">
          <div class="logo-box">${company?.logoUrl ? `<img src="${escapePrintHtml(company.logoUrl)}" alt="Logo">` : "LOGO"}</div>
          <div>
            <div class="company-name">${escapePrintHtml(company?.name ?? "-")}</div>
            <div class="company-meta">${escapePrintHtml(
              [company?.cuit ? `RUC ${company.cuit}` : null, company?.billingAddress || null]
                .filter(Boolean)
                .join(" · "),
            )}</div>
          </div>
        </div>
        <div class="doc-info">
          <span class="doc-badge">COMPROBANTE · ${escapePrintHtml((receipt.receiptType || "BOLETA").toUpperCase())}</span>
          <div class="doc-title">Nota de venta</div>
          <div class="doc-order">N° Orden: ${escapePrintHtml(receipt.orderNumber)}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="summary-row">
        ${qrDataUrl ? `<img src="${escapePrintHtml(qrDataUrl)}" alt="QR" class="summary-qr">` : ""}
        <div class="summary-grid">
          <div>
            <div class="summary-label">ESTADO</div>
            <span class="status-badge">${escapePrintHtml(statusLabel)}</span>
          </div>
          <div>
            <div class="summary-label">FECHA DE EMISIÓN</div>
            <div class="summary-value">${escapePrintHtml(emitido)}</div>
          </div>
          <div>
            <div class="summary-label">CANAL</div>
            <div class="summary-value">${escapePrintHtml(toTitleCase(receipt.salesChannel))}</div>
          </div>
          <div>
            <div class="summary-label">TIPO DE ENTREGA</div>
            <div class="summary-value">${escapePrintHtml(deliveryLabel)}</div>
          </div>
          <div>
            <div class="summary-label">COURIER</div>
            <div class="summary-value">${escapePrintHtml(orderHeader?.courier || "-")}</div>
          </div>
          <div>
            <div class="summary-label">MÉTODO DE PAGO</div>
            <div class="summary-value">${escapePrintHtml(paymentMethods)}</div>
          </div>
        </div>
      </div>

      <div class="customer-box">
        <div class="customer-title">DATOS DEL CLIENTE</div>
        <div class="customer-grid">
          <div>
            <div class="summary-label">NOMBRE</div>
            <div class="summary-value">${escapePrintHtml(receipt.customer.fullName)}</div>
          </div>
          <div>
            <div class="summary-label">TELÉFONO</div>
            <div class="summary-value">${escapePrintHtml(receipt.customer.phoneNumber || "-")}</div>
          </div>
          <div>
            <div class="summary-label">DNI</div>
            <div class="summary-value">${escapePrintHtml(receipt.customer.dni || "-")}</div>
          </div>
          <div class="full">
            <div class="summary-label">DIRECCIÓN</div>
            <div class="summary-value">${escapePrintHtml(direccion || "-")}</div>
          </div>
          ${receipt.delivery?.type === "AGENCY" && receipt.delivery.agency ? `<div class="full"><div class="summary-label">AGENCIA</div><div class="summary-value">${escapePrintHtml(receipt.delivery.agency)}</div></div>` : ""}
        </div>
      </div>

      <table class="items">
        <colgroup><col style="width:30%"><col style="width:25%"><col style="width:12%"><col style="width:16%"><col style="width:17%"></colgroup>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Variantes</th>
            <th class="num">Cantidad</th>
            <th class="num">P. Unitario</th>
            <th class="num">Subtotal</th>
          </tr>
        </thead>
        ${receipt.items
          .map((item, itemIndex) => {
            const tracking = getPrintableUnitCodes(receipt, item);
            return `<tbody data-pdf-item="${itemIndex}">
            <tr data-pdf-product-row>
              <td><b>${escapePrintHtml(item.productName)}</b></td>
              <td>${
                item.attributes
                  ? Object.entries(item.attributes)
                      .map(
                        ([key, value]) =>
                          `<span class="attr-pill">${escapePrintHtml(key)}: ${escapePrintHtml(value)}</span>`,
                      )
                      .join("")
                  : "-"
              }</td>
              <td class="num">${item.quantity}</td>
              <td class="num">S/ ${Number(item.unitPrice).toFixed(2)}</td>
              <td class="num">S/ ${Number(item.subtotal).toFixed(2)}</td>
            </tr>
            ${tracking?.codes.map((code) => `<tr class="unit-row" data-pdf-unit-code="${escapePrintHtml(code)}"><td colspan="5"><span class="unit-code">${escapePrintHtml(tracking.label)}: ${escapePrintHtml(code)}</span></td></tr>`).join("") ?? ""}
            ${tracking?.notice ? `<tr class="unit-row"><td colspan="5"><span class="unit-notice">${escapePrintHtml(tracking.notice)}</span></td></tr>` : ""}
          </tbody>`;
          })
          .join("")}
      </table>

      <div class="closing">
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
      </div>
    </div>
  `;
  return pdfHtml;
}

/** A4 at the same 800px width as the original note, before rasterization. */
export const NOTA_VENTA_PAGE_HEIGHT = (800 * 297) / 210;

/**
 * Lay out complete rows on each page, rather than cropping a tall bitmap.
 * A product and its first code stay together; subsequent pages repeat the
 * table heading and identify the product whose codes continue there.
 */
export function paginateNotaVentaDocument(
  root: HTMLElement,
  pageHeight = NOTA_VENTA_PAGE_HEIGHT,
): HTMLElement[] {
  const source = root.querySelector<HTMLElement>("[data-pdf-source]");
  if (!source) throw new Error("No se encontró el contenido del comprobante.");
  const doc = root.ownerDocument;
  const blocks = Array.from(source.children);
  source.remove();
  const pages: HTMLElement[] = [];
  const capacity = pageHeight - 72; // 32px top + 40px bottom including page number.
  if (capacity <= 0) throw new Error("El tamaño de página no es válido.");
  let content!: HTMLElement;
  const newPage = () => {
    const page = doc.createElement("div");
    page.className = "nota-venta-page";
    page.dataset.pdfPage = String(pages.length + 1);
    page.style.height = `${pageHeight}px`;
    content = doc.createElement("div");
    content.className = "nota-venta-content";
    if (pages.length) {
      const heading = doc.createElement("div");
      heading.className = "page-heading";
      heading.textContent = `Nota de venta - Orden ${root.dataset.orderNumber ?? ""}`;
      content.append(heading);
    }
    page.append(content);
    root.append(page);
    pages.push(page);
    return page;
  };
  const fits = () => content.getBoundingClientRect().height <= capacity;
  const tooLarge = () =>
    new Error(
      "Un bloque del comprobante supera una página. Revisa los datos antes de descargarlo.",
    );
  newPage();
  for (const block of blocks) {
    if (block.tagName !== "TABLE") {
      content.append(block);
      if (!fits()) {
        block.remove();
        if (!content.children.length) throw tooLarge();
        newPage();
        content.append(block);
        if (!fits()) throw tooLarge();
      }
      continue;
    }
    const originalTable = block as HTMLTableElement;
    let table!: HTMLTableElement;
    let body!: HTMLTableSectionElement;
    const newTable = () => {
      table = originalTable.cloneNode(false) as HTMLTableElement;
      for (const child of Array.from(originalTable.children))
        if (child.tagName === "COLGROUP" || child.tagName === "THEAD")
          table.append(child.cloneNode(true));
      content.append(table);
    };
    const newBody = (original: HTMLTableSectionElement) => {
      body = original.cloneNode(false) as HTMLTableSectionElement;
      table.append(body);
    };
    const nextTablePage = () => {
      // Avoid an orphan table heading if the first product did not fit.
      if (!table.querySelector("tbody tr")) table.remove();
      newPage();
      newTable();
    };
    newTable();
    for (const group of Array.from(originalTable.tBodies)) {
      const rows = Array.from(group.rows);
      if (!rows.length) continue;
      newBody(group);
      const first = rows.slice(0, Math.min(2, rows.length));
      body.append(...first);
      if (!fits()) {
        for (const row of first) row.remove();
        body.remove();
        nextTablePage();
        newBody(group);
        body.append(...first);
        if (!fits()) throw tooLarge();
      }
      for (const row of rows.slice(first.length)) {
        body.append(row);
        if (fits()) continue;
        row.remove();
        nextTablePage();
        newBody(group);
        const continuation = doc.createElement("tr");
        continuation.className = "item-continuation";
        continuation.dataset.pdfContinuation = "true";
        const cell = doc.createElement("td");
        cell.colSpan = rows[0].cells.length;
        cell.textContent = `${rows[0].cells[0].textContent ?? "Producto"} (continuación)`;
        continuation.append(cell);
        body.append(continuation, row);
        if (!fits()) throw tooLarge();
      }
    }
  }
  for (const [index, page] of pages.entries()) {
    const number = doc.createElement("div");
    number.className = "page-number";
    number.textContent = `Página ${index + 1} de ${pages.length}`;
    page.append(number);
  }
  return pages;
}

async function waitForReceiptImages(doc: Document): Promise<void> {
  await doc.fonts?.ready;
  await Promise.all(
    Array.from(
      doc.images,
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          const finish = () => {
            clearTimeout(timeout);
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            resolve();
          };
          const timeout = setTimeout(finish, 5000);
          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
        }),
    ),
  );
}

export async function downloadNotaVentaPdf(
  receipt: OrderReceipt,
  orderHeader: OrderHeader | null,
  company?: PrintLabelCompany | null,
  options?: PrintDocumentOptions,
): Promise<void> {
  const isCurrent = () => !options?.signal?.aborted && (options?.isCurrent?.() ?? true);
  if (!isCurrent()) return;
  const trackingUrlForQr = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
  const qrDataUrl = await generateQR(trackingUrlForQr, isCurrent);
  if (!isCurrent()) return;
  const pdfHtml = buildNotaVentaHtml(receipt, orderHeader, company, qrDataUrl);
  // Isolate the receipt from the application's Tailwind styles.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = `${NOTA_VENTA_PAGE_HEIGHT}px`;
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  try {
    const idoc = iframe.contentDocument;
    if (!idoc) throw new Error("No se pudo preparar el documento del comprobante");
    idoc.open();
    idoc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;">${pdfHtml}</body></html>`,
    );
    idoc.close();
    await waitForReceiptImages(idoc);
    if (!isCurrent()) return;
    const target = idoc.getElementById("pdf-comprobante-root");
    if (!target) throw new Error("No se pudo preparar el contenido del comprobante");
    const pages = paginateNotaVentaDocument(target);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    for (const [index, page] of pages.entries()) {
      if (!isCurrent()) return;
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      if (!isCurrent()) return;
      if (index) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, pageWidth, pageHeight);
    }
    if (!isCurrent()) return;
    pdf.save(`Comprobante_${receipt.orderNumber}.pdf`);
  } catch (err) {
    if (!isCurrent()) return;
    console.error("Error generando comprobante PDF", err);
    toast.error("No se pudo generar el comprobante");
  } finally {
    iframe.remove();
  }
}
