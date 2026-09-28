import { MAX_SERIES_LINEA, niceMax } from "@/features/panel-control/shared/utils/chart";
import { ChartDataDetails } from "./ChartDataDetails";
import { ChartTooltip } from "./ChartTooltip";

export interface LinePointAction {
  accion: string;
  onSelect: () => void;
}

export interface LineSeries {
  id: string;
  nombre: string;
  color: string;
  valores: number[];
  punteada?: boolean;
}

interface LineChartProps {
  etiquetas: string[];
  series: LineSeries[];
  ariaLabel: string;
  formatAxis: (value: number) => string;
  formatValue: (value: number) => string;
  height?: number;
  width?: number;
  puntos?: (serie: LineSeries, indice: number) => LinePointAction | null;
}

const PAD = { left: 52, right: 14, top: 10, bottom: 26 };

export function LineChart({
  etiquetas,
  series,
  ariaLabel,
  formatAxis,
  formatValue,
  height = 230,
  width = 1000,
  puntos,
}: LineChartProps) {
  const visibles = series.slice(0, MAX_SERIES_LINEA);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(1, ...visibles.flatMap((serie) => serie.valores)));
  const n = etiquetas.length;
  const sx = n > 1 ? innerW / (n - 1) : 0;
  const x = (index: number) => PAD.left + index * sx;
  const y = (value: number) => PAD.top + innerH - (innerH * value) / max;
  const step = Math.max(1, Math.ceil(n / (width / 70)));
  const slot = n > 1 ? sx : innerW;

  const descripcion = (index: number) =>
    `${etiquetas[index]}: ${visibles
      .map((serie) => `${serie.nombre} ${formatValue(serie.valores[index] ?? 0)}`)
      .join(", ")}`;

  return (
    <figure className="relative m-0">
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <ul className="mb-2 flex flex-wrap gap-3 text-xs text-pc-text-muted" aria-label="Series">
        {visibles.map((serie) => (
          <li key={serie.id} className="inline-flex items-center gap-1.5">
            <i
              aria-hidden
              className={
                serie.punteada
                  ? "inline-block h-0 w-4 border-t-2 border-dashed"
                  : "inline-block h-0.5 w-4 rounded"
              }
              style={serie.punteada ? { borderColor: serie.color } : { background: serie.color }}
            />
            {serie.nombre}
          </li>
        ))}
      </ul>
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
          {visibles.map((serie) => (
            <polyline
              key={serie.id}
              points={serie.valores.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
              fill="none"
              stroke={serie.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray={serie.punteada ? "5 4" : undefined}
            />
          ))}
          {etiquetas.map((etiqueta, index) =>
            index % step === 0 ? (
              <text
                key={etiqueta}
                x={x(index)}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--pc-text-soft)"
              >
                {etiqueta}
              </text>
            ) : null,
          )}
        </svg>
        <div
          className="absolute flex"
          style={{
            left: `${(Math.max(0, PAD.left - (n > 1 ? slot / 2 : 0)) / width) * 100}%`,
            right: `${(Math.max(0, PAD.right - (n > 1 ? slot / 2 : 0)) / width) * 100}%`,
            top: `${(PAD.top / height) * 100}%`,
            bottom: `${(PAD.bottom / height) * 100}%`,
          }}
        >
          {etiquetas.map((etiqueta, index) => (
            <span
              key={etiqueta}
              className="group relative h-full min-w-0 flex-1 hover:bg-pc-primary/5"
            >
              <ChartTooltip texto={descripcion(index)} />
            </span>
          ))}
        </div>
        {puntos && (
          <div className="pointer-events-none absolute inset-0">
            {etiquetas.flatMap((etiqueta, indice) =>
              visibles.map((serie, posicion) => {
                const punto = puntos(serie, indice);
                const valor = serie.valores[indice];
                if (!punto || typeof valor !== "number") return null;
                const coincidentes = visibles
                  .slice(0, posicion)
                  .filter(
                    (otra) =>
                      typeof otra.valores[indice] === "number" &&
                      Math.abs(y(otra.valores[indice] as number) - y(valor)) < 6,
                  ).length;
                return (
                  <button
                    key={`${serie.id}-${etiqueta}`}
                    type="button"
                    onClick={punto.onSelect}
                    aria-label={`${serie.nombre}, ${etiqueta}: ${formatValue(valor)}. ${punto.accion}`}
                    title={`${serie.nombre}, ${etiqueta}: ${formatValue(valor)}`}
                    className="pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-pc-card outline-none transition-transform hover:scale-150 focus-visible:scale-150 focus-visible:ring-2 focus-visible:ring-pc-primary"
                    style={{
                      left: `calc(${(x(indice) / width) * 100}% + ${coincidentes * 10}px)`,
                      top: `${(y(valor) / height) * 100}%`,
                      borderColor: serie.color,
                    }}
                  />
                );
              }),
            )}
          </div>
        )}
      </div>
      <ChartDataDetails
        titulo={ariaLabel}
        filas={etiquetas.map((etiqueta, index) => ({ clave: etiqueta, texto: descripcion(index) }))}
      />
    </figure>
  );
}
