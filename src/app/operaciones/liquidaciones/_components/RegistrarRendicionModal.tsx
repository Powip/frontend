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
import { MOCK_REPARTIDORES } from "./mockData";
import { RendicionRepartidor } from "./types";
import { money } from "./utils";

const MANUAL_OPTION = "__manual__";

/**
 * Modal de cuadre de caja para motorizado propio: cierra una rendición "por
 * rendir" existente (pre-llenando lo que debió cobrar) o registra una
 * manual para un repartidor/fecha no listado.
 *
 * BACKEND GAP: hoy "debió cobrar" es un número mock sembrado en
 * mockData.ts — no hay forma de calcularlo desde datos reales porque
 * OrderHeader no tiene un campo de repartidor asignado. Ver informe final.
 */
export function RegistrarRendicionModal({
  open,
  onOpenChange,
  pendientes,
  onRegistrar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendientes: RendicionRepartidor[];
  onRegistrar: (rendicion: RendicionRepartidor) => void;
}) {
  const [pendienteId, setPendienteId] = useState<string>(pendientes[0]?.id ?? MANUAL_OPTION);
  const [repartidor, setRepartidor] = useState<string>(MOCK_REPARTIDORES[0]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [debioCobrar, setDebioCobrar] = useState(0);
  const [entregoEfectivo, setEntregoEfectivo] = useState(0);
  const [observaciones, setObservaciones] = useState("");

  const seleccionada = pendientes.find((p) => p.id === pendienteId);
  const isManual = pendienteId === MANUAL_OPTION;

  useEffect(() => {
    if (!open) return;
    const first = pendientes[0];
    setPendienteId(first ? first.id : MANUAL_OPTION);
    setRepartidor(MOCK_REPARTIDORES[0]);
    setFecha(new Date().toISOString().slice(0, 10));
    setDebioCobrar(first?.debioCobrar ?? 0);
    setEntregoEfectivo(0);
    setObservaciones("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (seleccionada) {
      setDebioCobrar(seleccionada.debioCobrar);
      setEntregoEfectivo(seleccionada.debioCobrar);
    }
  }, [seleccionada]);

  const diferencia = Number((entregoEfectivo - debioCobrar).toFixed(2));

  const handleSubmit = () => {
    const rendicion: RendicionRepartidor = {
      id: seleccionada?.id ?? `RD-${Date.now()}`,
      repartidor: seleccionada?.repartidor ?? repartidor,
      fecha: seleccionada?.fecha ?? fecha,
      pedidosEntregados: seleccionada?.pedidosEntregados ?? 0,
      debioCobrar,
      entregoEfectivo,
      diferencia,
      estado: diferencia === 0 ? "CUADRADO" : "FALTANTE",
      observaciones: observaciones || undefined,
    };
    onRegistrar(rendicion);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar rendición</DialogTitle>
          <DialogDescription>
            Cuadre de caja de un motorizado propio: sin comisión de courier, a diferencia de
            Por Liquidar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Rendición</Label>
          <Select value={pendienteId} onValueChange={setPendienteId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pendientes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.repartidor} — {p.fecha} — debía {money(p.debioCobrar)}
                </SelectItem>
              ))}
              <SelectItem value={MANUAL_OPTION}>+ Registrar manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isManual && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Repartidor</Label>
              <Select value={repartidor} onValueChange={setRepartidor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_REPARTIDORES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha-rd">Fecha</Label>
              <Input id="fecha-rd" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="debio-cobrar">Debió cobrar (S/) *</Label>
            <Input
              id="debio-cobrar"
              type="number"
              step="0.01"
              value={debioCobrar}
              onChange={(e) => setDebioCobrar(Number(e.target.value))}
              disabled={!isManual}
              className={!isManual ? "bg-muted/40 font-semibold" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrego-efectivo">Entregó en efectivo (S/) *</Label>
            <Input
              id="entrego-efectivo"
              type="number"
              step="0.01"
              value={entregoEfectivo}
              onChange={(e) => setEntregoEfectivo(Number(e.target.value))}
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
            ? "Cuadrado: coincide exactamente."
            : `Faltante: ${money(diferencia)} de diferencia.`}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obs-rd">Observaciones</Label>
          <Textarea
            id="obs-rd"
            maxLength={400}
            placeholder="Opcional"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Guardar rendición</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
