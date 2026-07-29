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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuiaPorLiquidar, MetodoPago, METODO_PAGO_LABEL, PagoLiquidacion } from "./types";
import { money } from "./utils";

/**
 * Modal para conciliar un depósito de courier contra 1+ pedidos
 * seleccionados en "Por Liquidar". Calcula esperado vs. depositado y
 * marca la liquidación como Conciliada o Con diferencia.
 *
 * BACKEND GAP: no existe ningún endpoint para persistir esto — ver
 * `POST /shipping-guides/:guiaId/pagos` en BACKEND_REQUERIMIENTOS.md como
 * la referencia más cercana. El comprobante no se sube a ningún lado, solo
 * se guarda el nombre del archivo elegido.
 */
export function RegistrarLiquidacionModal({
  open,
  onOpenChange,
  guias,
  onRegistrar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guias: GuiaPorLiquidar[];
  onRegistrar: (pago: PagoLiquidacion) => void;
}) {
  const montoEsperado = guias.reduce((sum, g) => sum + g.saldoPendiente, 0);
  const courier = guias[0]?.courier ?? "—";

  const [montoDepositado, setMontoDepositado] = useState(montoEsperado);
  const [metodo, setMetodo] = useState<MetodoPago>("transferencia");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [comprobanteNombreArchivo, setComprobanteNombreArchivo] = useState<string | undefined>();
  const [observaciones, setObservaciones] = useState("");

  // Resetea el formulario cada vez que se abre con una selección nueva.
  useEffect(() => {
    if (open) {
      setMontoDepositado(montoEsperado);
      setMetodo("transferencia");
      setNumeroOperacion("");
      setFecha(new Date().toISOString().slice(0, 10));
      setComprobanteNombreArchivo(undefined);
      setObservaciones("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const diferencia = Number((montoDepositado - montoEsperado).toFixed(2));

  const handleSubmit = () => {
    const pago: PagoLiquidacion = {
      id: `LQ-${Date.now()}`,
      fecha,
      courier,
      pedidosIds: guias.map((g) => g.id),
      montoEsperado,
      montoDepositado,
      diferencia,
      metodo,
      numeroOperacion: numeroOperacion || undefined,
      comprobanteNombreArchivo,
      observaciones: observaciones || undefined,
      estado: diferencia === 0 ? "CONCILIADA" : "CON_DIFERENCIA",
    };
    onRegistrar(pago);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar liquidación — {courier}</DialogTitle>
          <DialogDescription>
            {guias.length} pedido{guias.length === 1 ? "" : "s"} seleccionado
            {guias.length === 1 ? "" : "s"} · marca esto como cubierto por un depósito del
            courier.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/20 p-2 text-xs">
          {guias.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-0.5">
              <span className="font-medium">{g.id}</span>
              <span className="text-muted-foreground">{g.cliente}</span>
              <span className="font-semibold">{money(g.saldoPendiente)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Monto esperado</Label>
            <Input value={money(montoEsperado)} disabled className="bg-muted/40 font-semibold" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monto-depositado">Monto depositado *</Label>
            <Input
              id="monto-depositado"
              type="number"
              step="0.01"
              value={montoDepositado}
              onChange={(e) => setMontoDepositado(Number(e.target.value))}
            />
          </div>
        </div>

        <div
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            diferencia === 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          }`}
        >
          {diferencia === 0
            ? "Conciliado: el monto coincide exactamente."
            : `Con diferencia: ${money(diferencia)} (${diferencia > 0 ? "depositó de más" : "depositó de menos"}). Se registrará también en la pestaña Diferencias.`}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Método de pago *</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoPago)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METODO_PAGO_LABEL) as MetodoPago[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {METODO_PAGO_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="num-op">N° de operación</Label>
          <Input
            id="num-op"
            placeholder="Op. 12345678"
            value={numeroOperacion}
            onChange={(e) => setNumeroOperacion(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="comprobante">Comprobante (opcional)</Label>
          <Input
            id="comprobante"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setComprobanteNombreArchivo(e.target.files?.[0]?.name)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obs">Observaciones</Label>
          <Textarea
            id="obs"
            maxLength={400}
            placeholder="Opcional, máx. 400 caracteres"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={guias.length === 0}>
            Registrar liquidación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
