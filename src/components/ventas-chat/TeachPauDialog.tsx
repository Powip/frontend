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
import { useProposeObjection } from "@/hooks/useCrmContent";
import { OBJECTION_NAME_MAX, OBJECTION_RESPONSE_MAX } from "./ContentLib";

interface Props {
  /** Último mensaje del cliente, para prellenar la pregunta. */
  initialQuestion: string;
  onClose: () => void;
}

/** «Enseñarle la respuesta a Pau»: propone una respuesta oficial a una duda del cliente. */
export default function TeachPauDialog({ initialQuestion, onClose }: Props) {
  const propose = useProposeObjection();
  const [name, setName] = useState(initialQuestion.slice(0, OBJECTION_NAME_MAX));
  const [response, setResponse] = useState("");
  const valid = !!name.trim() && !!response.trim();

  const submit = () => {
    if (!valid || propose.isPending) return;
    propose.mutate({ name: name.trim(), response: response.trim() }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enseñarle la respuesta a Pau</DialogTitle>
          <DialogDescription>
            Si eres administrador, Pau la usa desde ya. Si no, queda pendiente hasta que un administrador la apruebe.
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
            <Label htmlFor="teach-q">Pregunta del cliente</Label>
            <Input
              id="teach-q"
              value={name}
              maxLength={OBJECTION_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: ¿Hacen envíos a provincia?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="teach-a">Respuesta oficial</Label>
            <Textarea
              id="teach-a"
              rows={5}
              maxLength={OBJECTION_RESPONSE_MAX}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {response.length}/{OBJECTION_RESPONSE_MAX}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || propose.isPending}>
              Enviar respuesta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
