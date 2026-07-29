"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PedidosContent } from "./_components/PedidosContent";

/**
 * Pantalla "Pedidos" del módulo Operaciones nuevo — reemplaza la gestión de
 * pedidos que vivía en /operaciones (ahora Tablero, ver operaciones/page.tsx).
 * Toda la lógica vive en ./_components/PedidosContent — acá solo se resuelve
 * el Suspense boundary que exige `useSearchParams` en App Router.
 */
export default function PedidosPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-md rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <PedidosContent />
    </Suspense>
  );
}
