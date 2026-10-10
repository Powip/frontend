import { TrendingUp, Wallet, Clock3, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { PartnerSummary } from "@/features/partners/models/partner-summary";

interface PartnerKpiRowProps {
  summary: PartnerSummary | undefined;
  isLoading: boolean;
}

const COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  green: "border-l-green-500 text-green-600 dark:text-green-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
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
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

export function PartnerKpiRow({ summary, isLoading }: PartnerKpiRowProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        icon={<TrendingUp aria-hidden="true" className="h-4 w-4" />}
        color="teal"
        label="Recurrente activa / mes"
        value={formatSoles(summary.recurringActiveMonthly)}
        sub="Negocios pagando"
      />
      <Kpi
        icon={<Wallet aria-hidden="true" className="h-4 w-4" />}
        color="green"
        label="Comisión 1er mes (mes)"
        value={formatSoles(summary.firstMonthCommissionThisMonth)}
        sub="Pagos nuevos este mes"
      />
      <Kpi
        icon={<Clock3 aria-hidden="true" className="h-4 w-4" />}
        color="amber"
        label="Pendiente / en revisión"
        value={formatSoles(summary.pendingCommission)}
        sub="Activó, falta el pago"
      />
      <Kpi
        icon={<PiggyBank aria-hidden="true" className="h-4 w-4" />}
        color="purple"
        label="Acumulado pagado"
        value={formatSoles(summary.totalPaidToDate)}
        sub="Histórico"
      />
    </div>
  );
}
