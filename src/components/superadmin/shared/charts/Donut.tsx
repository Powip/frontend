"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DonutDatum {
  label: string;
  value: number;
  pct: number;
  color: string;
}

export function Donut({ data, centerLabel }: { data: DonutDatum[]; centerLabel?: string }) {
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={44} outerRadius={64} paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                borderColor: "hsl(var(--border))",
                borderRadius: "10px",
                fontSize: "11px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
            {centerLabel}
          </div>
        )}
      </div>
      <ul className="flex-1 space-y-1.5 text-[11.5px]">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-bold text-foreground">{d.value}</span>
            <span className="w-10 text-right text-muted-foreground">{d.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
