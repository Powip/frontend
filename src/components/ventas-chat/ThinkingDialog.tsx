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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import type { Conversation } from "@/types/crm";
import { fromLimaInput, toLimaInput } from "./agenda";
import { contactLabel } from "./format";

export const RESUME_NOTE_MAX = 200;

/** Mañana a las 09:00, hora Lima. */
function defaultResume() {
  const tomorrow = toLimaInput(new Date(Date.now() + 86_400_000).toISOString());
  return `${tomorrow.slice(0, 10)}T09:00`;
}

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

/** «Lo está pensando»: fecha y hora (Lima) para retomar el chat, con nota opcional. */
export default function ThinkingDialog({ conversation, onClose }: Props) {
  const { phoneMasked } = useCrmMe();
  const update = useUpdateConversation(conversation.id);
  const [due, setDue] = useState(defaultResume());
  const [note, setNote] = useState("");
  const valid = !!due && new Date(fromLimaInput(due)).getTime() > Date.now();

  const submit = () => {
    if (!valid || update.isPending) return;
    update.mutate(
      { resumeAt: fromLimaInput(due), ...(note.trim() ? { resumeNote: note.trim() } : {}) },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lo está pensando</DialogTitle>
          <DialogDescription>
            Cuándo retomar a {contactLabel(conversation, phoneMasked)}. Se crea una tarea «Retomar» en tu Agenda. La hora es de
            Lima. Si el cliente escribe antes, se retoma solo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="think-due">Retomar el</Label>
            <Input id="think-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            {due && !valid && <p className="text-xs text-destructive">Elige una fecha futura.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="think-note">Nota (opcional)</Label>
            <Textarea
              id="think-note"
              rows={2}
              maxLength={RESUME_NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: consulta con su esposo y me avisa"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || update.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
