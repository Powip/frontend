import { TAX_TYPES } from "@/api/sunat/types/sunat-document.types";
import { IGV_RATE } from "@/models/sunat/constants";
import { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";

type InvoiceItem = CreateManualInvoiceInput["items"][number];

/**
 * Recomputes totals from items using the exact same math as the
 * backend's buildInvoiceUblTemplate (unitPrice is treated as
 * tax-inclusive for GRAVADO items). Keeping this in sync with the
 * backend is what actually matters here — if the backend's tax math
 * ever changes, this needs to change with it, or the preview shown
 * here will drift from what SUNAT actually receives again.
 *
 * `totals` should never be edited or stored independently from
 * `items` anywhere in the UI — always derive it with this function.
 */
export function computeInvoiceTotals(items: InvoiceItem[]) {
  const lines = items.map((item) => {
    const isGravado = item.taxType === TAX_TYPES.GRAVADO;

    const unitValue = isGravado
      ? item.unitPrice / (1 + IGV_RATE)
      : item.unitPrice;

    const lineValue = +(unitValue * item.quantity).toFixed(2);

    const lineTax = isGravado
      ? +(item.unitPrice * item.quantity - lineValue).toFixed(2)
      : 0;

    return { lineValue, lineTax };
  });

  const totalValue = +lines
    .reduce((sum, l) => sum + l.lineValue, 0)
    .toFixed(2);

  const totalTax = +lines
    .reduce((sum, l) => sum + l.lineTax, 0)
    .toFixed(2);

  const totalPrice = +(totalValue + totalTax).toFixed(2);

  return { totalValue, totalTax, totalPrice };
}
