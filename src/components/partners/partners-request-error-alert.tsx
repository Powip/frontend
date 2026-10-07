"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PartnersRequestError } from "@/features/partners/models/partners-request-error";
import { getPartnersErrorMessage } from "@/features/partners/utils/partners-error-message";

interface PartnersRequestErrorAlertProps {
  error: PartnersRequestError;
  fallbackMessage: string;
  remainingMs?: number;
  onRetry?: () => void;
}

export function PartnersRequestErrorAlert({
  error,
  fallbackMessage,
  remainingMs = 0,
  onRetry,
}: PartnersRequestErrorAlertProps) {
  const isCoolingDown = remainingMs > 0;
  const message = getPartnersErrorMessage(
    error.kind === "rate_limited" ? { ...error, retryAfterMs: remainingMs } : error,
    fallbackMessage,
  );
  const showRetry = onRetry && error.kind !== "unauthorized" && error.kind !== "forbidden";

  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="space-y-2">
        <p>
          {error.kind === "rate_limited" && !isCoolingDown
            ? "Ya podés volver a intentar."
            : message}
        </p>
        {error.kind === "validation" && error.message && (
          <p className="text-xs">Detalle del servicio: {error.message}</p>
        )}
        {error.correlationId && (
          <p className="text-xs text-muted-foreground">
            Código de referencia: {error.correlationId}
          </p>
        )}
        {(error.kind === "unauthorized" || error.kind === "forbidden") && (
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        )}
        {showRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={isCoolingDown}>
            Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
