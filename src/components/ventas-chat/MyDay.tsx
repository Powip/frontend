"use client";
import { useState } from "react";
import { BarChart3, ChevronDown, FileText, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useTeamDay } from "@/hooks/useCrmTeam";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeamDay, TeamDayOrder } from "@/types/crmTeam";
import { NATIVE_SELECT_CLASS, formatMoney } from "./format";

const fmt = (v: number) => `S/ ${Math.round(v).toLocaleString("es-PE")}`;

type ListFilter = "all" | "dep" | "pc";

const STATE_LABEL: Record<TeamDayOrder["state"], { text: string; tone: string }> = {
  paid: { text: "Pagado", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  deposit: { text: "Adelanto · saldo al recibir", tone: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  on_delivery: { text: "Paga al recibir", tone: "bg-muted text-muted-foreground" },
  to_validate: { text: "Por validar en Finanzas", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

interface Props {
  /** Abre el chat del pedido en la Bandeja. */
  onOpenChat?: (conversationId: string) => void;
  /** Vista enfocada: sin la ecuación ni la nota. */
  compact?: boolean;
}

/**
 * «Mi día» del mockup 152: ventas de hoy contra la meta. La vendedora ve solo lo suyo;
 * el supervisor elige vendedora, Pau o todo el equipo. Datos reales de `GET /crm/team/day`.
 */
export default function MyDay({ onOpenChat, compact = false }: Props) {
  const { isSupervisor } = useCrmMe();
  const [who, setWho] = useState<string | undefined>(undefined);
  const q = useTeamDay(isSupervisor ? (who ?? "all") : undefined);
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<ListFilter | null>(null);
  const d: TeamDay | undefined = q.data;
  if (!d || !Array.isArray(d.orders) || !Array.isArray(d.sellers)) return null;

  const all = d.who === "all";
  const pct = d.goal > 0 ? Math.min(100, Math.round((d.billed / d.goal) * 100)) : 0;
  const cards: Array<{ key: string; label: string; value: string | number; tone?: string; detail: string; f: ListFilter }> = [
    {
      key: "count",
      label: "Ventas (pedidos)",
      value: d.count,
      detail: d.count ? "confirmadas hoy" : "aún sin ventas hoy",
      f: "all",
    },
    {
      key: "units",
      label: "Unidades",
      value: d.units,
      detail: d.count
        ? `${(d.units / d.count).toLocaleString("es-PE", { maximumFractionDigits: 1 })} por pedido`
        : "—",
      f: "all",
    },
    {
      key: "billed",
      label: "Facturación",
      value: fmt(d.billed),
      tone: "text-primary",
      detail: `valor de productos${d.count ? ` · ticket ${fmt(d.billed / d.count)}` : ""}`,
      f: "all",
    },
    {
      key: "deposits",
      label: "Adelantos",
      value: fmt(d.deposits),
      tone: "text-teal-700 dark:text-teal-400",
      detail: `${d.depositOrders} ${d.depositOrders === 1 ? "pedido" : "pedidos"} · clave retenida`,
      f: "dep",
    },
    {
      key: "pending",
      label: "Por cobrar",
      value: fmt(d.pending),
      tone: "text-amber-700 dark:text-amber-400",
      detail: `${d.pendingToValidate ? `${fmt(d.pendingToValidate)} por validar · ` : ""}${fmt(d.pendingOnDelivery)} al recibir`,
      f: "pc",
    },
  ];

  return (
    <section aria-label="Mi día" className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-2.5">
          <b className="inline-flex items-center gap-1.5 whitespace-nowrap text-[15px]">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
            {all ? "Ventas de hoy" : "Mi día"}
          </b>
          {isSupervisor && (
            <select
              aria-label="Ver números de"
              value={who ?? "all"}
              onChange={(e) => setWho(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-[170px] max-w-[220px] truncate py-1.5 text-[13px]")}
            >
              {d.sellers.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.userName}
                </option>
              ))}
              <option value="all">Todo el equipo</option>
            </select>
          )}
          {!compact && (
            <span className="text-xs text-muted-foreground">
              Cada vendedora ve solo lo suyo · el supervisor elige
            </span>
          )}
        </div>
        <div className="flex min-w-[200px] flex-[0_1_300px] flex-col gap-1">
          <div
            role="meter"
            aria-label="Avance de la meta"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-[7px] overflow-hidden rounded-full bg-muted"
          >
            <i className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs">
            <b>{pct} %</b> de la meta {fmt(d.goal)}
            {d.goal > 0 && (d.billed < d.goal ? ` · faltan ${fmt(d.goal - d.billed)}` : " · ¡meta cumplida! 🎉")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setList("all")}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden /> Ver ventas de hoy
          </button>
          <button
            type="button"
            aria-label={open ? "Ocultar resumen" : "Mostrar resumen"}
            title={open ? "Ocultar" : "Mostrar"}
            onClick={() => setOpen(!open)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <>
          <div role="group" aria-label="Resumen del día" className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {cards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setList(c.f)}
                className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-muted/40 px-3 py-2.5 text-left transition-shadow hover:border-primary hover:ring-2 hover:ring-primary/15 focus-visible:border-primary"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <b className={cn("whitespace-nowrap text-[21px] leading-tight", c.tone)}>{c.value}</b>
                <small className="truncate text-[11.5px] text-muted-foreground">{c.detail}</small>
              </button>
            ))}
          </div>
          {!compact && (
            <p className="m-0 text-xs leading-normal text-muted-foreground">
              <b className="text-foreground">{fmt(d.billed)}</b> facturado ={" "}
              <b className="text-emerald-700 dark:text-emerald-400">{fmt(d.collectedFull)}</b> cobrado completo +{" "}
              <b className="text-teal-700 dark:text-teal-400">{fmt(d.deposits)}</b> adelantos +{" "}
              <b className="text-amber-700 dark:text-amber-400">{fmt(d.pending)}</b> por cobrar. Ingreso solo cuenta lo
              validado; el adelanto no es ingreso hasta el pago total.
            </p>
          )}
        </>
      )}

      <DayList
        day={d}
        filter={list}
        onFilter={setList}
        onOpenChat={(id) => {
          setList(null);
          onOpenChat?.(id);
        }}
      />
    </section>
  );
}

function DayList({
  day,
  filter,
  onFilter,
  onOpenChat,
}: {
  day: TeamDay;
  filter: ListFilter | null;
  onFilter: (f: ListFilter | null) => void;
  onOpenChat: (conversationId: string) => void;
}) {
  const all = day.who === "all";
  const rows = day.orders.filter((o) =>
    filter === "dep" ? o.paid > 0 && o.paid < o.total : filter === "pc" ? o.total > o.paid : true,
  );
  const sum = rows.reduce((a, o) => ({ u: a.u + o.units, t: a.t + o.total, p: a.p + o.paid }), { u: 0, t: 0, p: 0 });
  const whoName = all ? "todo el equipo" : (day.sellers.find((s) => s.userId === day.who)?.userName ?? "");
  return (
    <Dialog open={filter !== null} onOpenChange={(v) => !v && onFilter(null)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ventas de hoy · {whoName}</DialogTitle>
          <DialogDescription>Pedidos confirmados hoy. Toca uno con chat para abrirlo.</DialogDescription>
        </DialogHeader>
        <div role="tablist" className="inline-flex self-start rounded-lg border p-0.5 text-xs">
          {(
            [
              ["all", `Todas (${day.count})`],
              ["dep", "Con adelanto"],
              ["pc", "Por cobrar"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              onClick={() => onFilter(k)}
              className={cn("rounded-md px-2.5 py-1", filter === k && "bg-primary text-primary-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Pedido</th>
                {all && <th className="px-3 py-2">Vendedora</th>}
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">Unid.</th>
                <th className="px-3 py-2 text-right">Facturación</th>
                <th className="px-3 py-2 text-right">Cobrado</th>
                <th className="px-3 py-2 text-right">Por cobrar</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((o) => (
                  <tr
                    key={o.orderId}
                    onClick={o.conversationId ? () => onOpenChat(o.conversationId as string) : undefined}
                    className={cn("border-t", o.conversationId && "cursor-pointer hover:bg-muted/40")}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{o.orderNumber ?? o.orderId.slice(0, 8)}</td>
                    {all && <td className="px-3 py-2 text-xs">{o.sellerName.split(" ")[0]}</td>}
                    <td className="px-3 py-2">
                      {o.customerName ?? "—"}
                      {o.conversationId && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">
                          <MessageCircle className="h-3 w-3" aria-hidden /> chat
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{o.units}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatMoney(o.total)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">{formatMoney(o.paid)}</td>
                    <td className={cn("px-3 py-2 text-right", o.pending > 0 && "font-semibold text-amber-700 dark:text-amber-400")}>
                      {formatMoney(o.pending)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATE_LABEL[o.state].tone)}>
                        {STATE_LABEL[o.state].text}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={all ? 8 : 7} className="px-3 py-5 text-center text-muted-foreground">
                    No hay pedidos en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t bg-muted/30 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={all ? 3 : 2}>
                    Total · {rows.length} {rows.length === 1 ? "pedido" : "pedidos"}
                  </td>
                  <td className="px-3 py-2 text-right">{sum.u}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(sum.t)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(sum.p)}</td>
                  <td className="px-3 py-2 text-right text-amber-700 dark:text-amber-400">{formatMoney(sum.t - sum.p)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          Facturación = valor de los productos. Se suma a la meta al confirmar la venta; el ingreso se reconoce cuando
          el pago se valida.
        </p>
      </DialogContent>
    </Dialog>
  );
}
