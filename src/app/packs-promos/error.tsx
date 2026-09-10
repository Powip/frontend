"use client";

import { RouteErrorFallback } from "@/components/shared/RouteErrorFallback";

/** Error Boundary de la ruta Packs & Promos. Next.js exige que sea Client
 *  Component y que reciba exactamente `{ error, reset }`. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback error={error} reset={reset} section="Packs & Promos" />
  );
}
