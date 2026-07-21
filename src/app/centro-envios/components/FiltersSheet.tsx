"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SalesFilters,
  emptySalesFilters,
  PAYMENT_METHODS,
  PENDING_BALANCE_OPTIONS,
  REGION_OPTIONS,
  DELIVERY_TYPE_OPTIONS,
  ZONE_OPTIONS,
  GUIDE_OPTIONS,
  SOURCE_OPTIONS,
} from "@/components/ventas/SalesTableFilters";
import { cn } from "@/lib/utils";

interface FiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SalesFilters;
  onFiltersChange: (filters: SalesFilters) => void;
  availableCouriers: string[];
}

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeFor(key: string): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const start = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offsetDays);
    return toISODate(d);
  };
  switch (key) {
    case "hoy":
      return { dateFrom: toISODate(today), dateTo: toISODate(today) };
    case "ayer": {
      const y = start(1);
      return { dateFrom: y, dateTo: y };
    }
    case "7d":
      return { dateFrom: start(6), dateTo: toISODate(today) };
    case "mes": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: toISODate(first), dateTo: toISODate(today) };
    }
    case "mesPasado": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { dateFrom: toISODate(first), dateTo: toISODate(last) };
    }
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

const QUICK_RANGES = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "7 días" },
  { key: "mes", label: "Este mes" },
  { key: "mesPasado", label: "Mes pasado" },
];

const selectClass =
  "w-full h-10 text-sm border rounded-md px-3 bg-background text-foreground";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 py-3.5 border-b last:border-0">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
    </div>
  );
}

export default function FiltersSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableCouriers,
}: FiltersSheetProps) {
  const activeCount = Object.values(filters).filter((v) => v !== "").length;

  const set = <K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-sm flex flex-col gap-0 p-0"
      >
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-lg">⚙️ Filtros avanzados</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <FilterField label="📅 Rango de fechas">
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_RANGES.map((r) => {
                const range = rangeFor(r.key);
                const active =
                  filters.dateFrom === range.dateFrom &&
                  filters.dateTo === range.dateTo;
                return (
                  <button
                    key={r.key}
                    onClick={() => onFiltersChange({ ...filters, ...range })}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-semibold border",
                      active
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => set("dateFrom", e.target.value)}
                className={selectClass}
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => set("dateTo", e.target.value)}
                className={selectClass}
              />
            </div>
          </FilterField>

          <FilterField label="🚚 Courier">
            <select
              value={filters.courier}
              onChange={(e) => set("courier", e.target.value)}
              className={selectClass}
            >
              <option value="">Todos</option>
              {availableCouriers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="📍 Zona de reparto">
            <select
              value={filters.zone}
              onChange={(e) => set("zone", e.target.value)}
              className={selectClass}
            >
              {ZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="🌎 Región">
            <select
              value={filters.region}
              onChange={(e) =>
                set("region", e.target.value as SalesFilters["region"])
              }
              className={selectClass}
            >
              {REGION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="📦 Tipo de envío">
            <select
              value={filters.deliveryType}
              onChange={(e) =>
                set(
                  "deliveryType",
                  e.target.value as SalesFilters["deliveryType"],
                )
              }
              className={selectClass}
            >
              {DELIVERY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="🔗 Guía de envío">
            <select
              value={filters.hasGuide}
              onChange={(e) =>
                set("hasGuide", e.target.value as SalesFilters["hasGuide"])
              }
              className={selectClass}
            >
              {GUIDE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="💰 Saldo">
            <select
              value={filters.hasPendingBalance}
              onChange={(e) =>
                set(
                  "hasPendingBalance",
                  e.target.value as SalesFilters["hasPendingBalance"],
                )
              }
              className={selectClass}
            >
              {PENDING_BALANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="💳 Método de pago">
            <select
              value={filters.paymentMethod}
              onChange={(e) => set("paymentMethod", e.target.value)}
              className={selectClass}
            >
              {PAYMENT_METHODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="🌐 Origen">
            <select
              value={filters.source}
              onChange={(e) =>
                set("source", e.target.value as SalesFilters["source"])
              }
              className={selectClass}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>

        <SheetFooter className="border-t p-4 gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onFiltersChange(emptySalesFilters)}
          >
            Limpiar todo
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Aplicar filtros{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
