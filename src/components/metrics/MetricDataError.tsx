"use client";

export function MetricDataError({ retry }: { retry: () => void }) {
  return (
    <div className="p-6">
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="font-medium">No se pudieron cargar los datos de este reporte.</p>
        <button type="button" onClick={retry} className="mt-3 rounded-md border px-4 py-2 text-sm">Reintentar</button>
      </div>
    </div>
  );
}
