"use client";

import { ArrowLeft, Loader2, Settings2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import LiveCopyButton from "./LiveCopyButton";
import { LiveErrorBanner, LiveFieldError } from "./LiveShared";
import { agreementText } from "./liveCommission";
import { getLiveSellerSales, liveError, liveMoney, payLiveSellerCommission } from "./liveService";
import type { LiveSeller, LiveSellerSaleLine, LiveSellerSales } from "./types";

/** Un pedido puede juntar compras de varios días: se muestra una fila por pedido. */
interface SaleRow {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  customer: string;
  units: number;
  sale: number;
  commission: number;
  state: LiveSellerSaleLine["state"];
}
export function saleRows(lines: LiveSellerSaleLine[]): SaleRow[] {
  const rows = new Map<string, SaleRow>();
  for (const line of lines) {
    const row = rows.get(line.orderId) ?? {
      orderId: line.orderId,
      orderNumber: line.orderNumber,
      createdAt: line.createdAt,
      customer: line.customer,
      units: 0,
      sale: 0,
      commission: 0,
      state: "VOID" as const,
    };
    if (line.state !== "VOID") {
      row.units += line.quantity;
      row.sale = Math.round((row.sale + line.paid) * 100) / 100;
      row.commission = Math.round((row.commission + line.commission) * 100) / 100;
    }
    // Basta una compra por validar para que el pedido siga «por confirmar».
    if (line.state === "PENDING" || (line.state === "CONFIRMED" && row.state === "VOID")) row.state = line.state;
    if (line.createdAt > row.createdAt) row.createdAt = line.createdAt;
    rows.set(line.orderId, row);
  }
  return [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const STATE: Record<LiveSellerSaleLine["state"], { label: string; className: string }> = {
  CONFIRMED: { label: "Validado", className: "bg-emerald-100 text-emerald-800" },
  PENDING: { label: "Por confirmar", className: "bg-amber-100 text-amber-800" },
  VOID: { label: "Anulado", className: "bg-slate-100 text-slate-600" },
};
const limaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" });

/** FEAT-33 C1: «Ver ventas» de una creadora: sus pedidos, su comisión y lo que se le pagó. */
export default function LiveSellerSalesView({
  storeId,
  seller,
  link,
  canManage,
  onBack,
  onAgreement,
  onChanged,
}: {
  storeId: string;
  seller: LiveSeller;
  link: string;
  canManage: boolean;
  onBack: () => void;
  onAgreement: () => void;
  onChanged: (seller: LiveSeller) => void;
}) {
  const [data, setData] = useState<LiveSellerSales | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const agreementKey = JSON.stringify(seller.agreement);
  const load = useCallback(async () => {
    try {
      setData(await getLiveSellerSales(storeId, seller.id));
      setError("");
    } catch (e) {
      setError(liveError(e));
    }
  }, [storeId, seller.id]);
  useEffect(() => {
    void load();
    // El acuerdo recalcula la comisión: se vuelve a pedir cuando cambia.
  }, [load, agreementKey]);
  const rows = useMemo(() => saleRows(data?.lines ?? []), [data]);
  const s = data?.stats ?? seller.stats;
  return (
    <div className="space-y-5">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Vendedores
      </Button>
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {seller.name}
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                Por comisión
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {seller.social ? `${seller.social} · ` : ""}Comisión acordada: {agreementText(seller.agreement)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button variant="outline" onClick={onAgreement}>
                <Settings2 className="h-4 w-4" /> Acuerdo de comisión
              </Button>
            ) : null}
            <LiveCopyButton text={link} label="Copiar link" size="default" />
          </div>
        </div>
        <p className="mt-3 truncate rounded-xl bg-muted/60 px-3 py-2 text-sm">🔗 {link}</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="seller-detail-kpis">
        <Kpi label="Pedidos" value={String(s.orders)} hint={`${s.units} prendas`} />
        <Kpi label="Ventas validadas" value={liveMoney(s.sales)} hint="sin envío" tone="text-teal-700" />
        <Kpi
          label="Comisión ganada"
          value={liveMoney(s.earned)}
          hint={`${liveMoney(s.pendingConfirmation)} cuando se validen sus pagos`}
        />
        <Kpi
          label="Por pagar"
          value={liveMoney(s.toPay)}
          hint={s.paid ? `Ya se le pagó ${liveMoney(s.paid)}` : "Aún no se le paga"}
          tone="text-amber-700"
        />
      </div>
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold">Sus ventas</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Son los mismos pedidos de Ventas, filtrados por vendedor. Del cliente solo se muestra el nombre y la inicial
          del apellido.
        </p>
        {error ? <LiveErrorBanner message={error} onRetry={() => void load()} /> : null}
        {!data && !error ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando ventas…
          </p>
        ) : null}
        {data ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Nº orden</th>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 text-right font-medium">Prendas</th>
                  <th className="py-2 pr-3 text-right font-medium">Venta</th>
                  <th className="py-2 pr-3 font-medium">Pago</th>
                  <th className="py-2 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.orderId} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium">{row.orderNumber}</td>
                      <td className="py-3 pr-3">{limaDate(row.createdAt)}</td>
                      <td className="py-3 pr-3">{row.customer}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{row.units}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{liveMoney(row.sale)}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE[row.state].className}`}>
                          {STATE[row.state].label}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        <b>{liveMoney(row.commission)}</b>
                        {row.state === "PENDING" ? <small className="block text-muted-foreground">pendiente</small> : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 text-muted-foreground">
                      Aún no tiene ventas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
        {canManage && s.toPay > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <span className="text-muted-foreground">
              Por pagar <b className="tabular-nums text-foreground">{liveMoney(s.toPay)}</b>
            </span>
            <Button onClick={() => setPaying(true)}>Marcar comisión como pagada</Button>
          </div>
        ) : null}
        {data?.payouts.length ? (
          <div className="mt-5 border-t pt-4">
            <h4 className="text-sm font-semibold">Pagos registrados</h4>
            <ul className="mt-2 grid gap-1 text-sm">
              {data.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {limaDate(p.paidAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <b className="tabular-nums">{liveMoney(p.amount)}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      {paying ? (
        <PayoutDialog
          storeId={storeId}
          seller={seller}
          owed={s.toPay}
          onClose={() => setPaying(false)}
          onPaid={(updated) => {
            setPaying(false);
            onChanged(updated);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint, tone = "" }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PayoutDialog({
  storeId,
  seller,
  owed,
  onClose,
  onPaid,
}: {
  storeId: string;
  seller: LiveSeller;
  owed: number;
  onClose: () => void;
  onPaid: (seller: LiveSeller) => void;
}) {
  const id = useId();
  const [amount, setAmount] = useState(owed.toFixed(2));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = Number(amount.replace(",", "."));
  const invalid = !(value > 0) || Math.round(value * 100) > Math.round(owed * 100);
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Marcar comisión como pagada</DialogTitle>
          <DialogDescription>
            Registra lo que le pagaste a {seller.name}. Se descuenta de lo que se le debe ({liveMoney(owed)}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1">
          <label htmlFor={`${id}-amount`} className="text-sm font-semibold">
            Monto pagado
          </label>
          <span className="flex items-center gap-2">
            <b>S/</b>
            <Input
              id={`${id}-amount`}
              inputMode="decimal"
              value={amount}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${id}-amount-error` : undefined}
              onChange={(e) => setAmount(e.target.value)}
            />
          </span>
          <LiveFieldError
            id={`${id}-amount-error`}
            message={invalid ? `Escribe un monto entre S/ 0.01 y ${liveMoney(owed)}.` : ""}
          />
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          Nota (opcional)
          <Input placeholder="Yape del 30/11" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || invalid}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const updated = await payLiveSellerCommission(storeId, seller.id, {
                  amount: Math.round(value * 100) / 100,
                  ...(note.trim() ? { note: note.trim() } : {}),
                });
                toast.success(`✓ Comisión de ${seller.name} marcada como pagada · ${liveMoney(value)}`);
                onPaid(updated);
              } catch (e) {
                setError(liveError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Marcar como pagada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
