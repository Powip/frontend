"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdvanceRow } from "@/utils/guideOrderBalance";

/**
 * Estados en los que un pedido pasa a manos del courier. Si hay un adelanto sin
 * aprobar, desde aquí el courier cobraría el total del pedido: se avisa antes.
 */
const DISPATCH_STATUSES: ReadonlySet<string> = new Set(["ASIGNADO_A_GUIA", "EN_ENVIO"]);

export const isDispatchStatus = (status: string | null | undefined): boolean =>
  !!status && DISPATCH_STATUSES.has(status);

const MAX_ROWS = 8;
const money = (value: number) => value.toFixed(2);

interface PendingAdvanceDialogProps {
  open: boolean;
  rows: AdvanceRow[];
  /** Cabeza de la frase de consecuencia, p. ej. "Si envías ahora". */
  action: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Aviso previo al despacho: pedidos con un adelanto registrado pero sin aprobar.
 * Ese adelanto no resta del cobro (un Yape sin aprobar podría ser falso), así que
 * el courier cobraría el total. Es un aviso, no un bloqueo: aprobar pagos es otro
 * permiso y bloquear dejaría pedidos parados esperando a otra persona.
 */
export function PendingAdvanceDialog({
  open,
  rows,
  action,
  confirmLabel,
  onConfirm,
  onCancel,
}: PendingAdvanceDialogProps) {
  const total = Math.round(rows.reduce((sum, row) => sum + row.awaitingApproval * 100, 0)) / 100;
  const many = rows.length !== 1;
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hay adelantos sin aprobar</AlertDialogTitle>
          <AlertDialogDescription>
            {many
              ? `${rows.length} pedidos tienen un adelanto sin aprobar`
              : "1 pedido tiene un adelanto sin aprobar"}{" "}
            (S/ {money(total)}). {action}, el courier cobrará el total{" "}
            {many ? "de cada pedido" : "del pedido"}, no el saldo. Apruébalos antes de
            despachar para que la guía salga con el monto correcto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {rows.slice(0, MAX_ROWS).map((row) => (
            <li key={row.id}>
              <b>{row.orderNumber}</b> · adelanto S/ {money(row.awaitingApproval)} · el
              courier cobrará S/ {money(row.pending)}
            </li>
          ))}
          {rows.length > MAX_ROWS && <li>y {rows.length - MAX_ROWS} más</li>}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface GuardOptions {
  rows: AdvanceRow[];
  action: string;
  confirmLabel: string;
}

interface PendingGuard extends GuardOptions {
  run: () => void | Promise<void>;
  settle: () => void;
}

/**
 * `guard(opciones, run)`: sin adelantos pendientes ejecuta `run` de inmediato; con
 * adelantos abre el aviso y ejecuta `run` solo si se confirma. La promesa devuelta
 * se resuelve cuando termina `run` o cuando se cancela, así quien hace `await`
 * (spinners, selección) conserva su comportamiento. `dialog` se renderiza una vez.
 */
export function usePendingAdvanceGuard(): {
  guard: (options: GuardOptions, run: () => void | Promise<void>) => Promise<void>;
  dismiss: () => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingGuard | null>(null);
  // La referencia evita que el cierre automático del diálogo tras "confirmar" cuente como cancelación.
  const pendingRef = useRef<PendingGuard | null>(null);

  const clear = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const dismiss = useCallback(() => {
    const current = pendingRef.current;
    clear();
    current?.settle();
  }, [clear]);

  const guard = useCallback(
    (options: GuardOptions, run: () => void | Promise<void>): Promise<void> => {
      if (options.rows.length === 0) return Promise.resolve(run());
      return new Promise<void>((resolve) => {
        // Un aviso nuevo reemplaza al abierto: se libera al que esperaba.
        pendingRef.current?.settle();
        const next: PendingGuard = { ...options, run, settle: resolve };
        pendingRef.current = next;
        setPending(next);
      });
    },
    [],
  );

  // Si el componente se desmonta con un aviso abierto, nadie debe quedar esperando.
  useEffect(() => () => pendingRef.current?.settle(), []);

  const confirm = useCallback(() => {
    const current = pendingRef.current;
    if (!current) return;
    clear();
    void (async () => {
      try {
        await current.run();
      } finally {
        current.settle();
      }
    })();
  }, [clear]);

  const dialog = (
    <PendingAdvanceDialog
      open={!!pending}
      rows={pending?.rows ?? []}
      action={pending?.action ?? ""}
      confirmLabel={pending?.confirmLabel ?? ""}
      onConfirm={confirm}
      onCancel={dismiss}
    />
  );

  return { guard, dismiss, dialog };
}
