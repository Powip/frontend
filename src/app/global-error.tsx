"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { captureAppError } from "@/lib/observability";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => captureAppError(error, "global-boundary"), [error]);
  return (
    <html lang="es">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
