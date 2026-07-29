"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

/**
 * Editor de "Observaciones" (campo `notes` de la orden).
 *
 * Ya existía la lógica de guardado en el /operaciones viejo pero sin botón
 * que la abriera (código muerto) — acá se le da un botón real (icono en la
 * columna Acciones de cada tabla), en vez de reescribir CustomerServiceModal
 * que no lo expone tampoco.
 */
interface NotesDialogProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  initialNotes: string;
  onSave: (notes: string) => Promise<void>;
}

export function NotesDialog({
  open,
  onClose,
  orderNumber,
  initialNotes,
  onSave,
}: NotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNotes(initialNotes);
  }, [open, initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(notes);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Observaciones — Orden #{orderNumber}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Notas internas sobre este pedido…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
