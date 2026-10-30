'use client';

import { useGoogleSheets } from '../hooks/useGoogleSheets';

/**
 * Cascarón mínimo: la interfaz del asistente se reconstruye sobre el hook
 * por pasos en las tareas T18/T19.
 */
export function GoogleSheetsConfigView() {
  const { step, error, loading } = useGoogleSheets();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Google Sheets</h1>
      {loading && <p>Cargando...</p>}
      {error && <p role="alert">{error}</p>}
      <p>Paso actual: {step}</p>
    </section>
  );
}
