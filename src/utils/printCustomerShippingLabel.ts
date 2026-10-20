import { toast } from "sonner";
import {
  escapePrintHtml,
  getPrintableUnitCodes,
  type PrintableReceiptItem,
  type PrintableReceiptTracking,
  type PrintDocumentOptions,
  renderPrintableUnitCodesHtml,
} from "./receiptUnitCodes";

export interface CustomerShippingReceipt extends PrintableReceiptTracking {
  orderNumber: string;
  customer: {
    fullName: string;
    dni?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    province?: string | null;
    city?: string | null;
    district?: string | null;
  };
  items?: readonly (PrintableReceiptItem & {
    productName?: string;
    sku?: string;
    attributes?: Record<string, unknown>;
  })[];
}
export interface CustomerShippingGuide {
  courierName?: string | null;
  shippingOffice?: string | null;
}
export interface CustomerShippingCompany {
  name?: string | null;
  cuit?: string | null;
  billingAddress?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

/** Keep the courier label's legacy address/layout and add tracked products only. */
export function buildCustomerShippingLabelHtml(
  receipt: CustomerShippingReceipt,
  shippingGuide: CustomerShippingGuide,
  company?: CustomerShippingCompany | null,
): string {
  const companyName = company?.name || "MI EMPRESA";
  const companyCuit = company?.cuit || "";
  const companyAddress = company?.billingAddress || "";
  const companyPhone = company?.phone || "";
  const companyLogo = company?.logoUrl;
  const courierName = shippingGuide.courierName || "COURIER";
  const customerAddress = shippingGuide.shippingOffice
    ? `${courierName} ${shippingGuide.shippingOffice}`
    : receipt.customer.address || "-";
  const logoElement = companyLogo
    ? `<img src="${escapePrintHtml(companyLogo)}" alt="${escapePrintHtml(companyName)}" class="brand-logo">`
    : `<div class="brand-name">${escapePrintHtml(companyName)}</div>`;
  const trackedItems = (receipt.items ?? []).filter((item) => getPrintableUnitCodes(receipt, item));
  const trackedProducts = trackedItems.length
    ? `<section class="tracked-products"><div class="section-title">PRODUCTOS IDENTIFICADOS</div>${trackedItems
        .map(
          (item) =>
            `<div class="tracked-product"><div class="tracked-product-name">${escapePrintHtml(item.productName || item.sku || "Producto")}</div><div class="tracked-product-meta">Cantidad: ${escapePrintHtml(item.quantity)}${item.sku ? ` · SKU: ${escapePrintHtml(item.sku)}` : ""}</div>${
              item.attributes
                ? `<div class="tracked-product-meta">${Object.entries(item.attributes)
                    .map(([key, value]) => `${escapePrintHtml(key)}: ${escapePrintHtml(value)}`)
                    .join(" · ")}</div>`
                : ""
            }${renderPrintableUnitCodesHtml(receipt, item)}</div>`,
        )
        .join("")}</section>`
    : "";
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprobante de Envío - ${escapePrintHtml(receipt.orderNumber)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
          }
          .container {
            border: 2px solid #000;
            padding: 20px;
          }
          .row {
            display: flex;
            margin-bottom: 15px;
          }
          .col-left {
            width: 45%;
            font-size: 10px;
            line-height: 1.4;
          }
          .col-right {
            width: 55%;
            text-align: right;
            display: flex;
            align-items: center;
            justify-content: flex-end;
          }
          .section-title {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 2px;
          }
          .brand-logo {
            max-height: 40px;
            max-width: 120px;
            object-fit: contain;
          }
          .brand-name {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .label {
            font-size: 9px;
            color: #666;
          }
          .consignado-title {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .customer-name {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .dni-row {
            margin-bottom: 4px;
            font-size: 10px;
          }
          .dni-label {
            font-weight: bold;
          }
          .info-value {
            font-size: 11px;
          }
          .location {
            font-size: 11px;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .address-line {
            font-size: 10px;
            text-transform: uppercase;
          }
          .courier-box {
            margin-top: 15px;
            padding-top: 12px;
            border-top: 1px solid #ccc;
          }
          .courier-name {
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .order-footer {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #999;
            font-size: 10px;
            text-align: center;
            color: #666;
          }
          .tracked-products { margin-top: 15px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11px; overflow-wrap: anywhere; }
          .tracked-product { margin-top: 8px; }
          .tracked-product-name { font-weight: bold; }
          .tracked-product-meta { margin-top: 2px; font-size: 10px; }
          @media print {
            body { padding: 10px; }
            @page { margin: 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="row">
            <!-- REMITENTE (lado izquierdo) -->
            <div class="col-left">
              <div class="section-title">REMITENTE</div>
              <div>${escapePrintHtml(companyName)}</div>
              ${companyCuit ? `<div>${escapePrintHtml(companyCuit)}</div>` : ""}
              ${companyAddress ? `<div>${escapePrintHtml(companyAddress)}</div>` : ""}
              ${companyPhone ? `<div>${escapePrintHtml(companyPhone)}</div>` : ""}
            </div>
            
            <!-- MARCA/LOGO (lado derecho) -->
            <div class="col-right">
              ${logoElement}
            </div>
          </div>

          <!-- CONSIGNADO -->
          <div style="text-align: right; margin-top: 10px;">
            <div class="consignado-title">CONSIGNADO</div>
            <div class="customer-name">${escapePrintHtml(receipt.customer.fullName)}</div>
            
            <div class="dni-row">
              <span class="dni-label">DNI</span> 
              <span class="info-value">${escapePrintHtml(receipt.customer.dni || "-")}</span>
            </div>
            
            <div class="dni-row">
              <span class="dni-label">TELEFONO</span> 
              <span class="info-value">${escapePrintHtml(receipt.customer.phoneNumber || "-")}</span>
            </div>
            
            <div class="location">
              ${escapePrintHtml(receipt.customer.province || "-")} - ${escapePrintHtml(receipt.customer.city || receipt.customer.province || "-")} - ${escapePrintHtml(receipt.customer.district || "-")}
            </div>
            
            <div class="address-line">
              ${escapePrintHtml(customerAddress)}
            </div>
          </div>

          ${trackedProducts}

          <!-- COURIER -->
          <div class="courier-box">
            <div class="courier-name">${escapePrintHtml(courierName.toUpperCase())}</div>
          </div>

        </div>
      </body>
      </html>
    `;
}

/** Resolve after printing or cancellation, retaining scope until the popup closes. */
export function printCustomerShippingLabel(
  receipt: CustomerShippingReceipt,
  shippingGuide: CustomerShippingGuide,
  company?: CustomerShippingCompany | null,
  options: PrintDocumentOptions = {},
): Promise<void> {
  const isCurrent = () => !options.signal?.aborted && (options.isCurrent?.() ?? true);
  if (!isCurrent()) return Promise.resolve();
  const printWindow = window.open("", "_blank", "width=500,height=700");
  if (!printWindow) {
    if (isCurrent()) toast.error("No se pudo abrir la ventana de impresión");
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      options.signal?.removeEventListener("abort", cancel);
      printWindow.onload = null;
      printWindow.onafterprint = null;
      printWindow.onbeforeunload = null;
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      printWindow.close();
      resolve();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      printWindow.close();
      if (isCurrent()) reject(error);
      else resolve();
    };
    const cancel = () => finish();
    options.signal?.addEventListener("abort", cancel, { once: true });
    const printLoadedDocument = () => {
      if (settled) return;
      if (!isCurrent()) {
        finish();
        return;
      }
      try {
        printWindow.focus();
        if (!isCurrent()) {
          finish();
          return;
        }
        printWindow.print();
        finish();
      } catch (error) {
        fail(error);
      }
    };
    try {
      if (!isCurrent()) {
        finish();
        return;
      }
      printWindow.document.open();
      printWindow.document.write(buildCustomerShippingLabelHtml(receipt, shippingGuide, company));
      if (!isCurrent()) {
        finish();
        return;
      }
      // document.open/write may reset popup listeners; install them before close.
      printWindow.onbeforeunload = finish;
      printWindow.onafterprint = finish;
      printWindow.onload = printLoadedDocument;
      printWindow.document.close();
    } catch (error) {
      fail(error);
    }
  });
}
