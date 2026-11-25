"use client";
import { useState } from "react";
import Link from "next/link";
import { CreditCard, Pencil, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SalesBoardExtra } from "@/types/crmAjustesE";
import type { SalesBoardRow } from "@/types/crmSalesTools";
import { formatMoney } from "./format";

/** Ventas (mockup 152, V3): columnas y acciones con datos del Core. */

const DELIVERY_LABEL: Record<string, string> = {
  DELIVERY: "Delivery",
  PROVINCIA: "Provincia",
  PUNTO_EXTERNO: "Agencia",
  RECOJO: "Recojo en tienda",
  RECOJO_TIENDA: "Recojo en tienda",
};

const label = (v: string | null | undefined, map: Record<string, string> = {}) =>
  v ? (map[v.toUpperCase()] ?? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/_/g, " ")) : null;

export function CityCell({ extra, loading }: { extra?: SalesBoardExtra; loading: boolean }) {
  if (!extra) return <span className="text-muted-foreground">{loading ? "…" : "—"}</span>;
  const place = [extra.city, extra.province].filter(Boolean).join(", ");
  return (
    <div className="leading-tight">
      <span>{place || "—"}</span>
      {extra.units !== null && (
        <span className="block text-xs text-muted-foreground">
          {extra.units} {extra.units === 1 ? "unidad" : "unidades"}
        </span>
      )}
    </div>
  );
}

export function PayShipCell({ extra, loading }: { extra?: SalesBoardExtra; loading: boolean }) {
  if (!extra) return <span className="text-muted-foreground">{loading ? "…" : "—"}</span>;
  const pay = extra.paymentMethods.map((m) => label(m)).filter(Boolean).join(", ");
  const ship = [label(extra.deliveryType, DELIVERY_LABEL), extra.courier].filter(Boolean).join(" · ");
  return (
    <div className="leading-tight">
      <span>{pay || "Sin pago"}</span>
      <span className="block text-xs text-muted-foreground">{ship || "Sin envío"}</span>
    </div>
  );
}

function PaymentsDialog({ row, extra, onClose }: { row: SalesBoardRow; extra?: SalesBoardExtra; onClose: () => void }) {
  const payments = extra?.payments ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pagos del pedido {row.number ?? row.coreId}</DialogTitle>
          <DialogDescription>
            Total {row.total === null ? "—" : formatMoney(row.total)} · Pagado {formatMoney(row.paid)} · Saldo{" "}
            {row.total === null ? "—" : formatMoney(Math.max(row.total - row.paid, 0))}
          </DialogDescription>
        </DialogHeader>
        {!extra ? (
          <p className="text-sm text-muted-foreground">No se pudieron leer los pagos del Core.</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay pagos registrados en el Core.</p>
        ) : (
          <ul className="divide-y text-sm" data-testid="payments-list">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>{" "}
                  <span className="text-muted-foreground">{label(p.method) ?? "Sin método"}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {label(p.status)}
                  {p.paidAt && new Date(p.paidAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  {p.proofUrl && (
                    <a href={p.proofUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                      Comprobante
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pagos, Editar y Seguimiento. El chat (WhatsApp) ya está en las acciones de la fila. */
export function ExtraActions({ row, extra }: { row: SalesBoardRow; extra?: SalesBoardExtra }) {
  const [open, setOpen] = useState(false);
  const ref = row.number ?? row.coreId;
  if (!row.orderId) return null;
  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="px-2" title="Ver pagos" aria-label={`Ver pagos de ${ref}`} onClick={() => setOpen(true)}>
        <CreditCard />
        <span className="sr-only">Pagos</span>
      </Button>
      <Button asChild size="sm" variant="ghost" className="px-2">
        <Link href={`/registrar-venta?orderId=${encodeURIComponent(row.orderId)}`} title="Editar en el Core" aria-label={`Editar ${ref} en el Core`}>
          <Pencil />
          <span className="sr-only">Editar</span>
        </Link>
      </Button>
      {extra?.trackingUrl ? (
        <Button asChild size="sm" variant="ghost" className="px-2">
          <a href={extra.trackingUrl} target="_blank" rel="noreferrer" title="Seguimiento del envío" aria-label={`Seguimiento de ${ref}`}>
            <Truck />
            <span className="sr-only">Seguimiento</span>
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled
          className="px-2"
          aria-label={`Seguimiento de ${ref}`}
          title={extra?.guideNumber ? `Guía ${extra.guideNumber}: sin enlace de seguimiento` : "Aún no tiene envío con seguimiento"}
        >
          <Truck />
          <span className="sr-only">Seguimiento</span>
        </Button>
      )}
      {open && <PaymentsDialog row={row} extra={extra} onClose={() => setOpen(false)} />}
    </>
  );
}
