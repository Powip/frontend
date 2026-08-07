"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { SaldoCliente } from "./types";
import { buildSaldoWhatsAppMessage, money, openSaldoWhatsApp } from "./utils";

/**
 * Recordatorio de cobranza masivo por WhatsApp a clientes con saldo
 * pendiente. Abre un `wa.me` por cliente (mismo patrón escalonado que
 * `handleBulkWhatsApp` en Pedidos/PedidosContent.tsx) — no hay envío real
 * server-side, es el mismo enfoque que ya usa el resto de la app.
 */
export function WhatsAppMasivoModal({
  open,
  onOpenChange,
  seleccionados,
  onSent,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seleccionados: SaldoCliente[];
  onSent: (ids: string[]) => void;
  onExport: () => void;
}) {
  const totalSaldo = seleccionados.reduce((s, c) => s + c.saldo, 0);
  const ejemplo = seleccionados[0];

  const handleEnviar = () => {
    seleccionados.forEach((c, index) => {
      setTimeout(() => openSaldoWhatsApp(c.telefono, c.cliente, c.orderNumber, c.saldo), index * 600);
    });
    onSent(seleccionados.map((c) => c.id));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-emerald-600" />
            Recordatorio de cobranza
          </DialogTitle>
          <DialogDescription>
            {seleccionados.length} cliente{seleccionados.length === 1 ? "" : "s"} seleccionado
            {seleccionados.length === 1 ? "" : "s"} · {money(totalSaldo)} por cobrar
          </DialogDescription>
        </DialogHeader>

        {ejemplo && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
            {buildSaldoWhatsAppMessage(ejemplo.cliente, ejemplo.orderNumber, ejemplo.saldo)}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Se personaliza por cada cliente con sus datos. Se abrirán {seleccionados.length} mensaje
          {seleccionados.length === 1 ? "" : "s"} de WhatsApp.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onExport();
            }}
          >
            Descargar lista
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={seleccionados.length === 0}
            onClick={handleEnviar}
          >
            Enviar {seleccionados.length} recordatorio{seleccionados.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
