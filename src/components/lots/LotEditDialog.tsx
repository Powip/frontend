"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LOT_COMMENT_MAX, LOT_NUMBER_MAX, isIsoDate, lotWriteErrorMessage } from "@/lib/lots";
import { updateLot, type LotRow, type UpdateLotBody } from "@/services/lotsService";

// FEAT-24 H5-L — corregir un lote (número, vencimiento y comentario). Solo
// Administrador u Operaciones. No mueve stock: el kardex muestra el número de
// hoy. El lote de devoluciones solo admite el comentario (y el estado).

export default function LotEditDialog({ lot, onClose, onSaved }: { lot: LotRow; onClose: () => void; onSaved: () => void }) {
  const returns = lot.kind === "devolucion";
  const [number, setNumber] = useState(lot.number);
  const [expiresAt, setExpiresAt] = useState(lot.expiresAt ?? "");
  const [comment, setComment] = useState(lot.comment ?? "");
  const [error, setError] = useState<string | null>(null);

  const body: UpdateLotBody = {};
  if (!returns && number.trim() !== lot.number) body.number = number.trim();
  if (!returns && expiresAt !== (lot.expiresAt ?? "")) body.expiresAt = expiresAt;
  if (comment.trim() !== (lot.comment ?? "")) body.comment = comment.trim() || null;
  const problem =
    !returns && !number.trim()
      ? "Escribe el número de lote."
      : number.trim().length > LOT_NUMBER_MAX
        ? `El número de lote tiene hasta ${LOT_NUMBER_MAX} caracteres.`
        : !returns && !isIsoDate(expiresAt)
          ? "Elige una fecha de vencimiento válida."
          : comment.trim().length > LOT_COMMENT_MAX
            ? `El comentario tiene hasta ${LOT_COMMENT_MAX} caracteres.`
            : null;

  const save = useMutation({
    mutationFn: () => updateLot(lot.lotId, body),
    onSuccess: () => {
      toast.success(`Lote ${body.number ?? lot.number} actualizado`);
      onSaved();
    },
    onError: (failure) => setError(lotWriteErrorMessage(failure, "No se pudo guardar el lote. Inténtalo de nuevo.")),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar lote {lot.number}</DialogTitle>
          <DialogDescription>Corrige el número, la fecha o el comentario. No mueve stock: el cambio vale para todos los almacenes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="lot-edit-number">Número de lote</Label>
            <Input id="lot-edit-number" className="font-mono" maxLength={LOT_NUMBER_MAX} value={number} disabled={returns || save.isPending} onChange={(event) => setNumber(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lot-edit-expires">Fecha de vencimiento</Label>
            <Input id="lot-edit-expires" type="date" value={expiresAt} disabled={returns || save.isPending} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="lot-edit-comment">Comentario (opcional)</Label>
            <Textarea
              id="lot-edit-comment"
              rows={2}
              maxLength={LOT_COMMENT_MAX}
              placeholder="Ej. Lote con caja dañada, vender primero"
              value={comment}
              disabled={save.isPending}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        </div>
        {returns ? <p className="text-xs text-muted-foreground">El lote de devoluciones no tiene número propio ni vencimiento: solo se cambia el comentario.</p> : null}
        {error || problem ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm text-destructive">
            {error ?? problem}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={save.isPending || problem !== null || Object.keys(body).length === 0}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? "Guardando…" : "Guardar lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
