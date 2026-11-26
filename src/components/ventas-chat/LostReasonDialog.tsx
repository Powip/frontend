"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LOST_REASONS, buildLostReason } from "./board";

interface Props {
  open: boolean;
  /** Nombre del contacto, para el título. */
  contact: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Pide el motivo al mover una conversación a una etapa «perdida». */
export default function LostReasonDialog({ open, contact, onConfirm, onCancel }: Props) {
  const [choice, setChoice] = useState<string>(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const reason = buildLostReason(choice, other);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Motivo de la pérdida</DialogTitle>
          <DialogDescription>
            ¿Por qué se perdió la venta con {contact}?
          </DialogDescription>
        </DialogHeader>
        <div role="group" aria-label="Motivos rápidos" className="flex flex-wrap gap-2">
          {LOST_REASONS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={choice === r ? "default" : "outline"}
              aria-pressed={choice === r}
              onClick={() => setChoice(r)}
            >
              {r}
            </Button>
          ))}
        </div>
        {choice === "Otro" && (
          <Input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Cuéntanos el motivo"
            aria-label="Motivo"
            maxLength={200}
            autoFocus
          />
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={!reason} onClick={() => onConfirm(reason)}>
            Guardar motivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
