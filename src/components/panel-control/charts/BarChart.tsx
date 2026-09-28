import { niceMax } from "@/features/panel-control/shared/utils/chart";
import { ChartDataDetails } from "./ChartDataDetails";
import { ChartTooltip } from "./ChartTooltip";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  comparison?: number | null;
  description: string;
  onSelect?: () => void;
  accion?: string;
}

interface BarChartProps {
  data: BarDatum[];
  ariaLabel: string;
  formatAxis: (value: number) => string;
  color?: string;
  height?: number;
  width?: number;
}

const PAD = { left: 52, right: 10, top: 10, bottom: 26 };

export function BarChart({
  data,
  ariaLabel,
  formatAxis,
  color = "var(--pc-series-1)",
  height = 220,
  width = 1000,
}: BarChartProps) {
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.value, d.comparison ?? 0))));
  const slot = data.length ? innerW / data.length : innerW;
  const barW = Math.max(2, slot - Math.max(2, slot * 0.28));
  const step = Math.max(1, Math.ceil(data.length / (width / 60)));
  const y = (value: number) => PAD.top + innerH - (innerH * value) / max;
  const comparaciones = data
    .map((datum, index) =>
      typeof datum.comparison === "number"
        ? `${PAD.left + index * slot + slot / 2},${y(datum.comparison)}`
        : null,
    )
    .filter((point): point is string => point !== null);

  return (
    <figure className="relative m-0">
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full overflow-visible"
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = (max * tick) / 4;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--pc-border-soft)"
                />
                <text
                  x={PAD.left - 8}
                  y={y(value) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--pc-text-soft)"
                >
                  {formatAxis(value)}
                </text>
              </g>
            );
          })}
          {data.map((datum, index) => {
            const x = PAD.left + index * slot;
            const barH = (innerH * datum.value) / max;
            return (
              <g key={datum.key}>
                {barH > 0 && (
                  <rect
                    x={x + (slot - barW) / 2}
                    y={y(datum.value)}
                    width={barW}
                    height={barH}
                    rx={3}
                    fill={color}
                  />
                )}
                {index % step === 0 && (
                  <text
                    x={x + slot / 2}
                    y={height - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--pc-text-soft)"
                  >
                    {datum.label}
                  </text>
                )}
              </g>
            );
          })}
          {data.length > 1 && comparaciones.length > 1 && (
            <polyline
              points={comparaciones.join(" ")}
              fill="none"
              stroke="var(--pc-text-soft)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
        </svg>
        <div
          className="absolute flex"
          style={{
            left: `${(PAD.left / width) * 100}%`,
            right: `${(PAD.right / width) * 100}%`,
            top: `${(PAD.top / height) * 100}%`,
            bottom: `${(PAD.bottom / height) * 100}%`,
          }}
        >
          {data.map((datum) =>
            datum.onSelect ? (
              <button
                key={datum.key}
                type="button"
                aria-label={`${datum.description}. ${datum.accion ?? "Ver pedidos"}`}
                onClick={datum.onSelect}
                className="group relative h-full min-w-0 flex-1 rounded-sm outline-none hover:bg-pc-primary/5 focus-visible:bg-pc-primary/10 focus-visible:ring-2 focus-visible:ring-pc-primary"
              >
                <ChartTooltip texto={datum.description} />
              </button>
            ) : (
              <span
                key={datum.key}
                className="group relative h-full min-w-0 flex-1 hover:bg-pc-primary/5"
              >
                <ChartTooltip texto={datum.description} />
              </span>
            ),
          )}
        </div>
      </div>
      <ChartDataDetails
        titulo={ariaLabel}
        filas={data.map((datum) => ({ clave: datum.key, texto: datum.description }))}
      />
    </figure>
  );
}
