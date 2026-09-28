interface ChartDataDetailsProps {
  titulo: string;
  filas: { clave: string; texto: string }[];
}

export function ChartDataDetails({ titulo, filas }: ChartDataDetailsProps) {
  if (!filas.length) return null;
  return (
    <details className="mt-1 text-xs text-pc-text-muted">
      <summary className="cursor-pointer select-none rounded text-[11px] font-semibold text-pc-primary outline-none focus-visible:ring-2 focus-visible:ring-pc-primary">
        Ver datos del gráfico
      </summary>
      <ul aria-label={titulo} className="mt-1 max-h-48 space-y-0.5 overflow-auto pl-1">
        {filas.map((fila) => (
          <li key={fila.clave}>{fila.texto}</li>
        ))}
      </ul>
    </details>
  );
}
