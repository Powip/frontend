"use client";

import { Suspense } from "react";
import { PedidosContent } from "./_components/PedidosContent";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";

/**
 * Pantalla "Pedidos" del módulo Operaciones nuevo — reemplaza la gestión de
 * pedidos que vivía en /operaciones (ahora Tablero, ver operaciones/page.tsx).
 * Toda la lógica vive en ./_components/PedidosContent — acá solo se resuelve
 * el Suspense boundary que exige `useSearchParams` en App Router.
 */
export default function PedidosPage() {
  return (
    <Suspense fallback={<PowipPulseLoader label="Cargando pedidos..." />}>
      <PedidosContent />
    </Suspense>
  );
}
