import { formatMoney } from "@/lib/money";
import { formatMoney as fromMerge } from "@/components/inventory/mergeStockCost";

describe("formatMoney (FEAT-24 H0)", () => {
  it("formatea en soles con dos decimales", () => {
    expect(formatMoney(1234.5)).toBe("S/ 1,234.50");
    expect(formatMoney("20")).toBe("S/ 20.00");
  });

  it.each([null, undefined, Number.NaN])("sin valor (%p) muestra S/ 0.00", (value) => {
    expect(formatMoney(value as number | null | undefined)).toBe("S/ 0.00");
  });

  it("mergeStockCost reexporta el mismo formateador", () => {
    expect(fromMerge).toBe(formatMoney);
  });
});
