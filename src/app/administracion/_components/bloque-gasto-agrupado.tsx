import type { GastoAgrupado } from "../_lib/gastosResumen";
import { formatSolesDecimales, PanelCard } from "./ui";

const MAX_FILAS = 5;

/** Bloque informativo del Resumen: total de una categoría de gasto y sus filas más grandes. */
export function BloqueGastoAgrupado({
  titulo,
  nota,
  vacio,
  datos,
}: {
  titulo: string;
  nota: string;
  vacio: string;
  datos: GastoAgrupado;
}) {
  const visibles = datos.filas.slice(0, MAX_FILAS);
  const resto = datos.filas.slice(MAX_FILAS);

  return (
    <PanelCard
      titulo={titulo}
      subtitulo={nota}
      acciones={<span className="text-sm font-bold tabular-nums text-pc-text">{formatSolesDecimales(datos.total)}</span>}
    >
      {datos.filas.length === 0 ? (
        <p className="text-xs text-pc-text-muted">{vacio}</p>
      ) : (
        <ul className="divide-y divide-pc-border-soft text-xs">
          {visibles.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0 truncate text-pc-text">
                {f.nombre}
                {f.registros > 1 && <span className="text-pc-text-muted"> · {f.registros} registros</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatSolesDecimales(f.total)}</span>
            </li>
          ))}
          {resto.length > 0 && (
            <li className="flex items-center justify-between gap-3 py-2 text-pc-text-muted last:pb-0">
              <span>y {resto.length} más (ver Costos › Gastos y costos)</span>
              <span className="shrink-0 tabular-nums">{formatSolesDecimales(resto.reduce((s, f) => s + f.total, 0))}</span>
            </li>
          )}
        </ul>
      )}
    </PanelCard>
  );
}
