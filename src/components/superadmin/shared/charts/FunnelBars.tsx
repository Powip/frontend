interface FunnelStep {
  etapa: string;
  count: number;
  pct: number;
  color: string;
}

export function FunnelBars({ data }: { data: FunnelStep[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((step) => (
        <div
          key={step.etapa}
          className="flex items-center rounded-lg px-3.5 py-2.5 text-white font-bold text-xs"
          style={{ backgroundColor: step.color, width: `${Math.max(28, (step.count / max) * 100)}%` }}
        >
          <span className="flex-1">{step.etapa}</span>
          <span className="text-sm font-extrabold">{step.count}</span>
          <span className="ml-2 text-[10px] opacity-90 font-semibold">{step.pct}%</span>
        </div>
      ))}
    </div>
  );
}
