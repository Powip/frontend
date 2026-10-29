import type { AdminPartner } from "@/features/partners/models/admin-partner";

export function PartnerDetailKpis({
  partner,
  isLoading,
}: {
  partner: AdminPartner | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !partner)
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold text-muted-foreground">Referidos manuales</div>
          <div className="mt-2 text-xl font-extrabold">{partner.manualReferralsCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold text-muted-foreground">Atribuciones LINK</div>
          <div className="mt-2 text-xl font-extrabold">{partner.linkAttributionsCount}</div>
        </div>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        Métricas financieras no disponibles: MRR, ticket promedio, comisiones, conversión de pago y
        LTV requieren el motor financiero. Una atribución LINK no confirma un pago.
      </p>
    </div>
  );
}
