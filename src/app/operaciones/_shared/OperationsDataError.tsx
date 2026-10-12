"use client";

import { Button } from "@/components/ui/button";

export function OperationsDataError({ retry, message = "No se pudieron cargar los pedidos." }: { retry: () => unknown; message?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p>{message}</p>
      <Button variant="outline" onClick={() => void retry()}>Reintentar</Button>
    </div>
  );
}
