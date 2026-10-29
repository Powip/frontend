import {
  hasCompletedBusinessQuestions,
  MONTHLY_ORDER_VOLUME_OPTIONS,
} from "@/lib/onboardingQuestions";

interface CompanyOnboardingProfile {
  onboarding_sales_channels?: string[] | null;
  monthly_order_volume?: string | null;
}

export function CompanyOnboardingSummary({ company }: { company: CompanyOnboardingProfile | null }) {
  const channels = company?.onboarding_sales_channels ?? [];
  const volume = MONTHLY_ORDER_VOLUME_OPTIONS.find(
    (option) => option.value === company?.monthly_order_volume,
  );
  const complete = hasCompletedBusinessQuestions({
    onboarding_sales_channels: channels,
    monthly_order_volume: volume?.value ?? null,
  });

  return (
    <section aria-label="Perfil del negocio" className="space-y-4 rounded-xl border border-white/5 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-white">Perfil del negocio</h3>
        <span
          className={complete
            ? "rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
            : "rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400"}
        >
          {complete ? "Completo" : "Pendiente de responder"}
        </span>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Canales de venta declarados
          </dt>
          <dd>
            {channels.length ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Canales declarados">
                {channels.map((channel) => (
                  <li key={channel} className="rounded-lg bg-primary/15 px-2 py-1 text-xs text-white/90">
                    {channel}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-gray-400">Pendiente de responder</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Pedidos despachados al mes
          </dt>
          <dd className="text-sm text-white/90">
            {volume?.label ?? <span className="text-gray-400">Pendiente de responder</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}
