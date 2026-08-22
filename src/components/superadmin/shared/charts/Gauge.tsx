"use client";

import { cn } from "@/lib/utils";

interface GaugeProps {
  value: number;
  max?: number;
  label: string;
  tone?: "red" | "amber" | "green";
}

export function Gauge({ value, max = 100, label, tone = "red" }: GaugeProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pct / 100) * circumference;
  const stroke =
    tone === "red" ? "stroke-red-500" : tone === "amber" ? "stroke-amber-500" : "stroke-emerald-500";
  const text =
    tone === "red" ? "text-red-600 dark:text-red-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex flex-col items-center justify-center py-1.5">
      <svg width="120" height="120" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={cn("-mt-[76px] text-2xl font-extrabold", text)}>{value}</div>
      <div className="mt-[52px] text-center text-[11px] text-muted-foreground max-w-[140px]">{label}</div>
    </div>
  );
}
