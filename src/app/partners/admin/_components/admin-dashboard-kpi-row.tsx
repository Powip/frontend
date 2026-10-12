import type { AdminDashboardSummary } from "@/features/partners/models/admin-dashboard-summary";

const METRICS = [
  ["partnersTotal", "Partners (activos y suspendidos)"],
  ["partnersActive", "Partners activos"],
  ["partnersSuspended", "Partners suspendidos"],
  ["applicationsPending", "Solicitudes pendientes"],
  ["applicationsRejected", "Solicitudes rechazadas"],
  ["manualReferrals", "Referidos manuales"],
  ["codeReferrals", "Referidos por código"],
  ["legacyLinkReferrals", "Referidos LINK históricos"],
  ["linkAttributions", "Atribuciones LINK"],
  ["capturedClaims", "Capturas de enlace"],
  ["attachedClaims", "Capturas asociadas"],
] as const;

export function AdminDashboardKpiRow({
  summary,
  isLoading,
}: {
  summary: AdminDashboardSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map(([key]) => (
          <div key={key} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRICS.map(([key, label]) => (
        <div key={key} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-2 text-xl font-extrabold text-foreground">{summary.counts[key]}</div>
        </div>
      ))}
    </div>
  );
}
