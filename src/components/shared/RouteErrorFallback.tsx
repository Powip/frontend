"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface RouteErrorFallbackProps {
  /** Error capturado por el Error Boundary de la ruta (lo pasa Next.js). */
  error: Error & { digest?: string };
  /** Reintenta renderizar el segmento que falló. */
  reset: () => void;
  /** Nombre legible de la sección — se usa en el título y en el log. */
  section?: string;
}

/** Fallback visible y reutilizable para los `error.tsx` de ruta.
 *
 *  Hasta ahora un TypeError en el render de cualquier consumidor de `usePacks()`
 *  (u otro hook) desmontaba la página entera dejando la pantalla en blanco y sin
 *  rastro en consola. Este componente muestra una card con opción de reintento y
 *  loguea el error para poder diagnosticarlo. */
export function RouteErrorFallback({
  error,
  reset,
  section,
}: RouteErrorFallbackProps) {
  useEffect(() => {
    // Único rastro del crash: hoy no queda ninguno en la consola.
    console.error("[RouteError]", section, error);
  }, [error, section]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Algo salió mal{section ? ` en ${section}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              Podés reintentar. Si el problema persiste, recargá la página o
              avisá a soporte.
            </p>
          </div>
          <Button onClick={reset} className="rounded-xl">
            Reintentar
          </Button>
          {error.digest && (
            <p className="text-[11px] text-muted-foreground">
              Código de error: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
