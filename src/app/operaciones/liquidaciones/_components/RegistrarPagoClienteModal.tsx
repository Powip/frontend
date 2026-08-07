"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaldoCliente } from "./types";
import { money } from "./utils";

/**
 * Registra que el cliente terminó de pagar su saldo pendiente. BACKEND
 * GAP: no hay endpoint para esto — hoy solo actualiza el estado local de
 * `saldosClientes` en page.tsx. Ver informe final.
 */
export function RegistrarPagoClienteModal({
  cliente,
  onOpenChange,
  onConfirm,
}: {
  cliente: SaldoCliente | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, montoRecibido: number) => void;
}) {
  const [monto, setMonto] = useState(0);

  useEffect(() => {
    if (cliente) setMonto(cliente.saldo);
  }, [cliente]);

  return (
    <Dialog open={!!cliente} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {cliente && (
          <>
            <DialogHeader>
              <DialogTitle>Registrar pago recibido</DialogTitle>
              <DialogDescription>
                {cliente.cliente} · pedido {cliente.orderNumber} · saldo {money(cliente.saldo)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="monto-pago">Monto recibido (S/) *</Label>
              <Input
                id="monto-pago"
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(Number(e.target.value))}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onConfirm(cliente.id, monto);
                  onOpenChange(false);
                }}
              >
                Registrar pago
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
