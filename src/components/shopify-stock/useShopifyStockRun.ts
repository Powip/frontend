"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  parseRunRequestError,
  pollStockRun,
  RUN_STATUS_LABELS,
  StockRunPollTimeoutError,
} from "@/lib/shopifyStock";
import { getShopifyStockRun, requestShopifyStockRun } from "@/services/shopifyStockService";

// FEAT-24 H1-D (H1D-5) — «Generar reporte»: pide la corrida y la sigue hasta que termina.

interface Follow {
  /** Avisa con toasts (la pidió el usuario); una corrida retomada al cargar solo se sigue. */
  notify: boolean;
}

export function useShopifyStockRun(shopId: string, runningRunId: string | null, onFinished: () => void) {
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  const follow = useCallback(async (runId: string, { notify }: Follow) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setFollowingId(runId);
    try {
      const run = await pollStockRun(runId, { fetchRun: getShopifyStockRun, signal: ctrl.signal });
      if (notify) {
        if (run.status === "ok") toast.success("El reporte está listo.");
        else {
          const why = run.error ?? run.writeBlockedReason;
          toast.error(`El reporte terminó: ${RUN_STATUS_LABELS[run.status].toLowerCase()}${why ? `. ${why}` : ""}`);
        }
      }
      finished.current();
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (notify) {
        toast.error(
          err instanceof StockRunPollTimeoutError
            ? err.message
            : "No se pudo consultar el estado del reporte. Vuelve a mirar en unos minutos.",
        );
      }
    } finally {
      if (controller.current === ctrl) {
        controller.current = null;
        setFollowingId(null);
      }
    }
  }, []);

  // Una corrida que ya estaba en curso al cargar (la diaria o una pedida antes) se sigue sin avisos.
  useEffect(() => {
    if (runningRunId && !controller.current) void follow(runningRunId, { notify: false });
  }, [runningRunId, follow]);

  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  const start = useCallback(async () => {
    setRequesting(true);
    try {
      const res = await requestShopifyStockRun(shopId);
      toast.info("Generando el reporte. Puede tardar unos minutos.");
      void follow(res.runId, { notify: true });
    } catch (err) {
      const failure = parseRunRequestError(err);
      if (failure.kind === "running" && failure.runningRunId) {
        toast.info(failure.message);
        void follow(failure.runningRunId, { notify: true });
      } else {
        toast.error(failure.message);
      }
    } finally {
      setRequesting(false);
    }
  }, [shopId, follow]);

  return { start, running: followingId !== null, requesting };
}
