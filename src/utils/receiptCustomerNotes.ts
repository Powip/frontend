import { escapePrintHtml } from "./receiptUnitCodes";

/** Only the comment explicitly shared with the customer belongs on the label. */
export function renderReceiptCustomerNotesHtml(customerNotes?: string | null): string {
  if (typeof customerNotes !== "string" || !customerNotes.trim()) return "";

  return `<div class="order-comments" style="margin:10px 0;padding:8px;border:1px solid #333;break-inside:avoid;page-break-inside:avoid;min-width:0;">
    <div style="font-size:11px;font-weight:bold;margin-bottom:4px;">Comentarios del pedido</div>
    <div class="order-comments-text" style="font-size:12px;font-weight:400;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapePrintHtml(customerNotes)}</div>
  </div>`;
}
