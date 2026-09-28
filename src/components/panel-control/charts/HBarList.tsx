"use client";

import { formatPercent } from "@/features/panel-control/shared/utils/format";
import { cn } from "@/lib/utils";
import { PanelEmpty } from "../PanelStates";

export interface HBarRow {
  key: string;
  label: string;
  value: number;
  dotColor?: string;
  barColor?: string;
  description?: string;
  onSelect?: () => void;
}

interface HBarListProps {
  rows: HBarRow[];
  formatValue: (value: number) => string;
  total?: number;
  ariaLabel: string;
}

export function HBarList({ rows, formatValue, total, ariaLabel }: HBarListProps) {
  if (!rows.length) return <PanelEmpty />;
  const max = Math.max(1, ...rows.map((row) => row.value));
  const suma = total ?? rows.reduce((acc, row) => acc + row.value, 0);

  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const share = suma ? row.value / suma : null;
        const contenido = (
          <>
            <span className="flex min-w-0 items-center gap-1.5 truncate text-left">
              {row.dotColor && (
                <i
                  aria-hidden
                  className="inline-block size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: row.dotColor }}
                />
              )}
              <span className="truncate">{row.label}</span>
            </span>
            <span aria-hidden className="h-3 overflow-hidden rounded bg-pc-border-soft">
              <span
                className="block h-full rounded-r"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  background: row.barColor ?? "var(--pc-series-1)",
                }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums">
              {formatValue(row.value)}
              <small className="ml-1 font-medium text-pc-text-muted">{formatPercent(share)}</small>
              {row.onSelect && (
                <span aria-hidden className="ml-0.5 font-bold text-pc-primary">
                  ›
                </span>
              )}
            </span>
          </>
        );
        const clases =
          "grid w-full grid-cols-[minmax(80px,150px)_1fr_minmax(96px,auto)] items-center gap-2.5 rounded-md text-xs text-pc-text";
        const etiqueta =
          row.description ?? `${row.label}: ${formatValue(row.value)} (${formatPercent(share)})`;
        return (
          <li key={row.key}>
            {row.onSelect ? (
              <button
                type="button"
                onClick={row.onSelect}
                aria-label={`${etiqueta}. Ver pedidos`}
                className={cn(
                  clases,
                  "outline-none hover:text-pc-primary focus-visible:ring-2 focus-visible:ring-pc-primary",
                )}
              >
                {contenido}
              </button>
            ) : (
              <div className={clases} title={etiqueta}>
                {contenido}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
