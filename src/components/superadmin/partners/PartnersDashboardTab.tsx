"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Target, Crown } from "lucide-react";
import { getKpisPartners } from "@/services/superadmin/partnersService";
import { SectionHeader, StatusBadge, TableSkeleton } from "@/components/superadmin/shared";
import { money, moneyCompact } from "@/components/superadmin/shared/format";

const NIVEL_TONE = { Oro: "amber", Plata: "gray", Base: "blue" } as const;

export function PartnersDashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "partners", "kpis"], queryFn: getKpisPartners });

  if (isLoading || !data) return <TableSkeleton rows={6} cols={4} />;

  return (
    <div>
      <SectionHeader title="ROI del canal" sub="Partners vs. adquisición paga" />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-primary" />
            CAC por partners
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">{money(data.cacPartners)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">vs. {money(data.cacAds)} en ads pagos</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {data.roiPct >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            ROI del canal
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">{data.roiPct}%</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">MRR referido vs. comisiones pagadas del mes</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Crown className="h-3.5 w-3.5 text-primary" />
            Ahorro vs. CAC ads
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">
            {data.cacAds > 0 ? Math.round(((data.cacAds - data.cacPartners) / data.cacAds) * 100) : 0}%
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Costo de adquisición más bajo por referido</div>
        </div>
      </div>

      <SectionHeader title="Top partners" sub="Ordenados por MRR activo referido" />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Partner</th>
              <th className="px-3 py-2 text-left font-semibold">Nivel</th>
              <th className="px-3 py-2 text-left font-semibold">Referidos</th>
              <th className="px-3 py-2 text-right font-semibold">MRR activo</th>
            </tr>
          </thead>
          <tbody>
            {data.topPartners.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-semibold">{p.nombre}</div>
                      <div className="text-[10.5px] text-muted-foreground">{p.handle}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge label={p.nivel} tone={NIVEL_TONE[p.nivel]} />
                </td>
                <td className="px-3 py-2">{p.referidosCount}</td>
                <td className="px-3 py-2 text-right font-bold">{moneyCompact(p.mrrActivo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
