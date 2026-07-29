"use client";

import { OperationsRoleProvider } from "@/contexts/OperationsRoleContext";

/**
 * Layout compartido por las pantallas del módulo Operaciones nuevo
 * (Tablero /operaciones, Pedidos /operaciones/pedidos, Guías & Courier
 * /operaciones/guias, Liquidaciones /operaciones/liquidaciones). Reemplaza
 * a las antiguas /centro-envios, /seguimiento y /couriers — ver esas rutas,
 * ahora redirects.
 */
export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperationsRoleProvider>
      <div className="w-full px-4 py-4 md:px-6 md:py-6 space-y-4">{children}</div>
    </OperationsRoleProvider>
  );
}
