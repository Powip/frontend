"use client";

import { CircleDollarSign, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AvatarCircle, SectionCard } from "./shared";
import {
  mockCostos,
  mockDistribucionMensual,
  mockEvolucionMensual,
  mockFinanzasCards,
  mockIngresosDiarios,
  mockPuntoEquilibrio,
} from "./mock-data";

const ACCENT: Record<string, { border: string; value: string }> = {
  emerald: { border: "border-l-emerald-500", value: "text-emerald-600 dark:text-emerald-400" },
  amber: { border: "border-l-amber-500", value: "text-amber-600 dark:text-amber-400" },
  red: { border: "border-l-red-500 bg-red-50/40 dark:bg-red-500/5", value: "text-red-600 dark:text-red-400" },
};

export function FinanzasTab() {
  const maxIngreso = Math.max(...mockIngresosDiarios.map((d) => d.amount), 1);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-300/70 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
        <CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-emerald-800 dark:text-emerald-300">Ingresos ≠ Ventas.</span>{" "}
          <span className="text-emerald-700/80 dark:text-emerald-400/80">
            Los <strong>ingresos diarios</strong> son los cobros reales recibidos cada día (pagos, adelantos,
            liquidaciones courier). Son distintos a la <strong>facturación de ventas</strong> (órdenes confirmadas),
            que puede cobrarse en días diferentes.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard title="Distribución mensual de ingresos" subtitle="Cobros reales recibidos por mes (pagos + adelantos)">
          <div className="flex flex-col gap-3">
            {mockDistribucionMensual.map((m) => (
              <div key={m.mes} className="flex items-center gap-2.5">
                <AvatarCircle initials={m.initial} color={m.color} />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {m.mes}{" "}
                      {m.tag && <span className={cn("text-[10px] font-normal ml-1", m.tagClass ?? "text-muted-foreground")}>{m.tag}</span>}
                    </span>
                    <span className="text-xs font-bold text-foreground">{m.monto}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", m.color)} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Detalle de ingresos diarios" subtitle="Cobros recibidos por día (≠ ventas del día)">
          <div className="flex items-end gap-1 h-24">
            {mockIngresosDiarios.map((d) => (
              <div key={d.day} className="flex-1 h-full flex items-end">
                <div
                  className={cn("w-full rounded-t", d.isToday ? "bg-blue-500" : "bg-emerald-500")}
                  style={{ height: d.amount === 0 ? "0%" : `${Math.max((d.amount / maxIngreso) * 100, 4)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {mockIngresosDiarios.map((d) => (
              <span
                key={d.day}
                className={cn(
                  "flex-1 text-center text-[9px]",
                  d.isToday ? "text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground"
                )}
              >
                {d.day}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">Total período (parcial)</p>
              <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">S/ 8,507.20</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Pico · día 01</p>
              <p className="text-sm font-bold text-foreground">S/ 1,100</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Últ. día · 11</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">S/ 760</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-blue-300/70 dark:border-blue-800 bg-blue-50 dark:bg-blue-500/10 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-blue-800 dark:text-blue-300">Reconocimiento de ingreso · COD.</span>{" "}
          <span className="text-blue-700/80 dark:text-blue-400/80">
            Facturación desde Confirmado. Ingreso real (dinero en mano) al momento de Entrega y liquidación courier.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5">
        {mockFinanzasCards.map((card) => (
          <div key={card.label} className={cn("rounded-xl border border-border border-l-4 bg-card p-4", ACCENT[card.accent].border)}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{card.label}</p>
            <p className={cn("text-xl font-extrabold tracking-tight", ACCENT[card.accent].value)}>{card.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-emerald-300/70 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
        ✓ Cobrado (S/73,440) + No liquidado (S/18,600) + En tránsito (S/21,750) + No despachados (S/13,260) = S/127,050
      </div>

      <div className="grid grid-cols-3 gap-3.5">
        {mockCostos.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-amber-50/40 dark:bg-amber-500/5 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <span className="rounded bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5">ADMIN</span>
            </div>
            <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">{c.sub}</p>
          </div>
        ))}
        <div className="rounded-xl p-4 bg-gradient-to-br from-violet-600 to-violet-500 text-white">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Ganancia bruta aprox.</p>
            <span className="rounded bg-white/25 text-[9px] font-bold px-1.5 py-0.5">ADMIN</span>
          </div>
          <p className="text-xl font-extrabold">42% · S/ 43,549</p>
          <p className="text-[11px] text-white/75 mt-1.5">Antes de gastos fijos operativos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard
          title="Evolución mensual"
          right={
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          }
        >
          <div className="flex flex-col gap-2">
            {mockEvolucionMensual.map((m) => (
              <div key={m.mes} className="flex items-center gap-2.5">
                <span className={cn("min-w-[46px] text-xs", m.bold ? "font-bold text-emerald-700 dark:text-emerald-400" : "font-medium text-muted-foreground")}>
                  {m.mes}
                </span>
                <span className={cn("h-2 w-2 rounded-full shrink-0", m.color)} />
                <div className="flex-1 h-5 rounded bg-muted overflow-hidden relative">
                  <div className={cn("h-full rounded flex items-center pl-2", m.color)} style={{ width: `${m.pct}%` }}>
                    <span className="text-[10px] font-bold text-white truncate">{m.monto}</span>
                  </div>
                </div>
                {m.trend ? (
                  <span className={cn("text-[11px] font-bold min-w-[38px] text-right", m.trendClass)}>{m.trend}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground min-w-[38px] text-right">{m.full}</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Punto de equilibrio" right={<span className="rounded bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5">Admin</span>}>
          <div className="flex flex-col">
            {mockPuntoEquilibrio.map((p) => (
              <div key={p.label} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <span className={cn("text-sm font-bold", p.className ?? "text-foreground")}>{p.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 mt-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Margen de seguridad</span>
              <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                6.4× sobre el punto de equilibrio
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
