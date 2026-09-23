import { TrendingUp, Wallet, Tag, Landmark, PiggyBank, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminDashboardSummary } from "@/features/partners/models/admin-dashboard-summary";

interface AdminDashboardKpiRowProps {
  summary: AdminDashboardSummary | undefined;
  isLoading: boolean;
}

const COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  green: "border-l-green-500 text-green-600 dark:text-green-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
  red: "border-l-red-500 text-red-600 dark:text-red-400",
  purple: "border-l-violet-500 text-violet-600 dark:text-violet-400",
};

function Kpi({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={cn("rounded-xl border border-l-4 bg-card p-4 shadow-sm", COLOR[color])}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-extrabold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

export function AdminDashboardKpiRow({ summary, isLoading }: AdminDashboardKpiRowProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Kpi
        icon={<TrendingUp aria-hidden="true" className="h-4 w-4" />}
        color="teal"
        label="MRR referido"
        value={formatSoles(summary.referredMrr)}
        sub="Ingreso mensual traído"
      />
      <Kpi
        icon={<Wallet aria-hidden="true" className="h-4 w-4" />}
        color="green"
        label="Comisiones (mes)"
        value={formatSoles(summary.monthlyCommissions)}
        sub="1er mes + recurrente"
      />
      <Kpi
        icon={<Tag aria-hidden="true" className="h-4 w-4" />}
        color="amber"
        label="Descuentos dados"
        value={formatSoles(summary.discountsGiven)}
        sub="10% a nuevos referidos"
      />
      <Kpi
        icon={<Landmark aria-hidden="true" className="h-4 w-4" />}
        color="red"
        label="Costo del canal"
        value={formatSoles(summary.channelCost)}
        sub="Comisiones + descuentos"
      />
      <Kpi
        icon={<PiggyBank aria-hidden="true" className="h-4 w-4" />}
        color="purple"
        label="LTV traído"
        value={formatSoles(summary.ltvBrought)}
        sub="Estimado × 15 meses"
      />
      <Kpi
        icon={<Gauge aria-hidden="true" className="h-4 w-4" />}
        color="teal"
        label="ROI del canal"
        value={`${summary.channelRoiMultiplier}×`}
        sub="LTV / costo"
      />
    </div>
  );
}
