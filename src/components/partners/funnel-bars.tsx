import type { PartnerFunnelStep } from "@/features/partners/models/partner-summary";

interface FunnelBarsProps {
  steps: PartnerFunnelStep[];
}

export function FunnelBars({ steps }: FunnelBarsProps) {
  const max = Math.max(1, ...steps.map((step) => step.count));

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <div key={step.label}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{step.label}</span>
            <span className="tabular-nums font-semibold text-foreground">{step.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(step.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
