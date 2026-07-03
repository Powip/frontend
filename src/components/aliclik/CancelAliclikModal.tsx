"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  cancelAliclikOrder,
  type AliclikCancelWarehouseResult,
} from "@/services/aliclikService";

// ─── HELPERS ────────────────────────────────────────────

const RESULT_CONFIG: Record<
  AliclikCancelWarehouseResult["result"],
  { label: string; icon: React.ReactNode; cls: string }
> = {
  cancelled: {
    label: "Cancelado",
    icon: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
    cls: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300",
  },
  cancel_pending: {
    label: "Cancelación diferida",
    icon: <Clock className="h-4 w-4 text-amber-500 shrink-0" />,
    cls: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300",
  },
  rejected: {
    label: "Rechazado",
    icon: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
    cls: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300",
  },
};

// ─── PROPS ──────────────────────────────────────────────

interface CancelAliclikModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  companyId?: string;
  onSuccess?: () => void;
}

// ─── ESTADOS DEL MODAL ──────────────────────────────────

type ModalPhase = "confirm" | "loading" | "result";

// ─── COMPONENTE ─────────────────────────────────────────

export default function CancelAliclikModal({
  open,
  onClose,
  orderId,
  companyId: propCompanyId,
  onSuccess,
}: CancelAliclikModalProps) {
  const { auth } = useAuth();
  const companyId = propCompanyId ?? auth?.company?.id;
  const token = auth?.accessToken ?? "";

  const [phase, setPhase] = useState<ModalPhase>("confirm");
  const [results, setResults] = useState<AliclikCancelWarehouseResult[]>([]);

  // Reiniciar al abrir
  React.useEffect(() => {
    if (open) {
      setPhase("confirm");
      setResults([]);
    }
  }, [open]);

  const handleCancel = async () => {
    if (!companyId) {
      toast.error("No se pudo determinar la empresa para cancelar el pedido");
      return;
    }

    setPhase("loading");

    try {
      const data = await cancelAliclikOrder(token, orderId, companyId);
      setResults(data.results);
      setPhase("result");

      const allCancelled = data.results.every((r) => r.result === "cancelled");
      const anyRejected = data.results.some((r) => r.result === "rejected");

      const mixedCancelledAndPending =
        !anyRejected &&
        data.results.some((r) => r.result === "cancelled") &&
        data.results.some((r) => r.result === "cancel_pending");

      if (allCancelled) {
        toast.success("Pedido cancelado en Aliclik correctamente");
      } else if (anyRejected) {
        toast.error("Uno o más almacenes no pudieron cancelarse en Aliclik");
      } else if (mixedCancelledAndPending) {
        toast.success("Cancelación parcial — revisá el resumen por almacén");
      } else {
        toast.success("Cancelación registrada — Aliclik la procesará al confirmar");
      }

      // onSuccess se invoca siempre tras respuesta del servidor: incluso con almacenes rejected el intento se persistió y conviene refrescar.
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al cancelar el pedido en Aliclik";
      toast.error(msg);
      setPhase("confirm");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md bg-white dark:bg-slate-900"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Cancelar en Aliclik
          </DialogTitle>
        </DialogHeader>

        {/* Fase: confirmación */}
        {phase === "confirm" && (
          <div className="space-y-5 pt-2">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">
                Esta acción cancelará el pedido en{" "}
                <span className="font-bold">todos los almacenes de Aliclik</span>{" "}
                en los que fue despachado. ¿Confirmás?
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                No, volver
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
              >
                Sí, cancelar en Aliclik
              </Button>
            </div>
          </div>
        )}

        {/* Fase: cargando */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin text-red-500" />
            <p className="text-sm font-medium">Cancelando en Aliclik...</p>
          </div>
        )}

        {/* Fase: resultado */}
        {phase === "result" && results.length > 0 && (
          <div className="space-y-4 pt-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Resultado por almacén:
            </p>

            <div className="space-y-2">
              {results.map((r) => {
                const config = RESULT_CONFIG[r.result];
                return (
                  <div
                    key={r.warehouseId}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${config.cls}`}
                  >
                    {config.icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          Almacén {r.warehouseId}
                        </span>
                        <span className="font-bold text-xs uppercase tracking-wide">
                          {config.label}
                        </span>
                      </div>
                      {r.externalOrderNumber && (
                        <p className="text-xs font-mono opacity-75 mt-0.5">
                          #{r.externalOrderNumber}
                        </p>
                      )}
                      {r.reason && (
                        <p className="text-xs mt-1 opacity-80">{r.reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {results.some((r) => r.result === "cancel_pending") && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                Los almacenes con cancelación diferida serán cancelados por Aliclik
                cuando se confirme el pedido.
              </p>
            )}

            <div className="flex justify-end pt-1">
              <Button
                onClick={onClose}
                className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-bold px-8"
              >
                Entendido, cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
