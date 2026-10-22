"use client";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
const supported = (
  Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
).supportedValuesOf;
const currencies = supported
  ? supported("currency")
  : ["PEN", "USD", "EUR", "CLP", "COP", "MXN", "ARS", "BRL"];
export function reportCurrencyLabel(currency: string | undefined) {
  return currency === "UNKNOWN"
    ? "Sin moneda registrada"
    : currency === "PEN" || !currency
      ? "S/"
      : currency;
}
export function ReportCurrencySelector() {
  const { currency = "PEN", setCurrency } = useDashboardScope();
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      Moneda del reporte
      <select
        aria-label="Moneda del reporte"
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        className="rounded-md border bg-background px-2 py-2 text-sm text-foreground"
      >
        {Array.from(new Set(["PEN", "USD", ...currencies])).map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
        <option value="UNKNOWN">Sin moneda registrada</option>
      </select>
    </label>
  );
}
