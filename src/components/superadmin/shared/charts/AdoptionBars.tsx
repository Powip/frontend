export function AdoptionBars({ data }: { data: { modulo: string; pct: number }[] }) {
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.modulo} className="flex items-center gap-2.5 text-[11.5px]">
          <span className="w-24 shrink-0 font-medium text-muted-foreground">{d.modulo}</span>
          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
              style={{ width: `${d.pct}%` }}
            />
          </span>
          <span className="w-9 text-right font-bold">{d.pct}%</span>
        </li>
      ))}
    </ul>
  );
}
