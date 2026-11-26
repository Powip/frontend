"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicTrackingPage } from "@/components/public-tracking/PublicTrackingPage";
import {
  getPublicOrderTracking,
  PublicTrackingNotFoundError,
} from "@/features/whatsapp/api/public-tracking.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import type { PublicTrackingState } from "@/features/whatsapp/models/public-tracking.model";

/** C-30 — Página pública que abre el comprador desde el aviso de WhatsApp. */
export function PublicTrackingView({ token }: { token: string }) {
  const available = isWhatsAppContractAvailable("publicTracking");
  const [state, setState] = useState<PublicTrackingState>(
    available ? { kind: "loading" } : { kind: "pending-integration" },
  );
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    setState({ kind: "loading" });
    getPublicOrderTracking(token)
      .then((data) => alive && setState({ kind: "ready", data }))
      .catch((error: Error) => {
        if (!alive) return;
        setState(
          error instanceof PublicTrackingNotFoundError
            ? { kind: "not-found" }
            : { kind: "error", message: error.message },
        );
      });
    return () => {
      alive = false;
    };
  }, [token, available, attempt]);

  return <PublicTrackingPage state={state} onRetry={retry} />;
}
