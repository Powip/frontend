/**
 * A document line whose sale value ends up at S/ 0.00 once its discount is
 * subtracted.
 */
export interface LineWithoutValue {
  /** 1-based, as SUNAT reports it ("Error en la linea: 1"). */
  lineNumber: number;
  productName: string;
}

interface LineAmounts {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
}

/**
 * Lines SUNAT would reject with error 3105 ("El XML debe contener al menos
 * un tributo por linea de afectacion por IGV").
 *
 * SUNAT checks the tax of every line against its sale value (quantity x unit
 * price - line discount, at 2 decimals). When that value is 0.00 it rejects
 * the WHOLE document, and a rejected document has already spent its number.
 * It happens with ordinary sales: a gift at price 0, a product with a 100%
 * discount, or free shipping stored as a shipping line whose discount equals
 * its price.
 *
 * The backend refuses these too (`SUNAT_DOCUMENT_LINE_WITHOUT_VALUE`); this
 * lets the screen say it before sending, with the same rounding.
 */
export function findLinesWithoutValue(items: LineAmounts[]): LineWithoutValue[] {
  return items.flatMap((item, index) => {
    const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    const lineValue = Number((subtotal - (Number(item.discountAmount) || 0)).toFixed(2));

    return lineValue > 0 ? [] : [{ lineNumber: index + 1, productName: item.productName }];
  });
}

/** "«Regalo»" or "«Regalo» y «Servicio de entrega»". */
export function describeLinesWithoutValue(lines: LineWithoutValue[]): string {
  return lines.map((line) => `«${line.productName}»`).join(" y ");
}
