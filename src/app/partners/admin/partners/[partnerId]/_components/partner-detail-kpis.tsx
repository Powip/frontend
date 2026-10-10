import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminPartner } from "@/features/partners/models/admin-partner";

interface PartnerDetailKpisProps {
  partner: AdminPartner | null | undefined;
  isLoading: boolean;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-extrabold text-foreground">{value}</div>
    </div>
  );
}

export function PartnerDetailKpis({ partner, isLoading }: PartnerDetailKpisProps) {
  if (isLoading || !partner) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Kpi label="Referidos" value={`${partner.referralsCount} · ${partner.activeReferralsCount}a`} />
      <Kpi label="MRR generado" value={formatSoles(partner.mrr)} />
      <Kpi label="Ticket promedio" value={formatSoles(partner.ticketPromedio)} />
      <Kpi label="Recurrente/mes" value={formatSoles(partner.recurringCommissionMonthly)} />
      <Kpi label="Conversión" value={`${partner.conversionPct}%`} />
      <Kpi label="LTV estimado" value={formatSoles(partner.ltvEstimado)} />
    </div>
  );
}
