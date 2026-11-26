"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useSendTemplate } from "@/hooks/useCrmChat";
import { useTemplates } from "@/hooks/useCrmEngagement";
import type { Conversation, Template } from "@/types/crm";
import { firstName } from "./ContentLib";
import { NATIVE_SELECT_CLASS, fillTemplateBody } from "./format";

const AJUSTES_HREF = "/comercial/ventas-chat/ajustes";

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

const keyOf = (t: Template) => `${t.name}::${t.language}`;

/** Elegir una plantilla aprobada, rellenar sus variables y enviarla (ventana de 24 h cerrada). */
export default function TemplateDialog({ conversation, onClose }: Props) {
  const templates = useTemplates();
  const send = useSendTemplate(conversation.id);
  const approved = useMemo(
    () => (templates.data ?? []).filter((t) => t.status === "APPROVED"),
    [templates.data],
  );
  const [selected, setSelected] = useState<string>("");
  const [vars, setVars] = useState<string[]>([]);

  const template = approved.find((t) => keyOf(t) === selected) ?? null;

  const choose = (key: string) => {
    setSelected(key);
    const t = approved.find((x) => keyOf(x) === key);
    const count = t?.variableCount ?? 0;
    // La primera variable suele ser el nombre: se prellena con el primer nombre del contacto.
    setVars(Array.from({ length: count }, (_, i) => (i === 0 ? firstName(conversation) : "")));
  };

  const complete = !!template && vars.every((v) => v.trim());
  const err = templates.isError ? crmError(templates.error) : null;

  const submit = () => {
    if (!template || !complete || send.isPending) return;
    send.mutate(
      {
        templateName: template.name,
        templateLanguage: template.language,
        ...(vars.length ? { variables: vars.map((v) => v.trim()) } : {}),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar plantilla</DialogTitle>
          <DialogDescription>
            La ventana de 24 h está cerrada. WhatsApp solo deja escribir primero con una plantilla aprobada.
          </DialogDescription>
        </DialogHeader>

        {templates.isLoading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
          </p>
        )}
        {err && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {err.message}
          </p>
        )}
        {templates.data && approved.length === 0 && (
          <p role="status" className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            No hay plantillas aprobadas. Crea y aprueba una en Meta, y revisa la conexión de WhatsApp en{" "}
            <Link href={AJUSTES_HREF} className="font-medium text-primary underline">
              Ajustes
            </Link>
            .
          </p>
        )}

        {approved.length > 0 && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="tpl-select">Plantilla</Label>
              <select
                id="tpl-select"
                className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
                value={selected}
                onChange={(e) => choose(e.target.value)}
              >
                <option value="" disabled>
                  Elige una plantilla
                </option>
                {approved.map((t) => (
                  <option key={keyOf(t)} value={keyOf(t)}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            </div>

            {template && (
              <>
                {vars.map((v, i) => (
                  <div key={i} className="space-y-1.5">
                    <Label htmlFor={`tpl-var-${i + 1}`}>{`Variable {{${i + 1}}}`}</Label>
                    <Input
                      id={`tpl-var-${i + 1}`}
                      value={v}
                      maxLength={200}
                      onChange={(e) => setVars((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
                  <p
                    data-testid="template-preview"
                    className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-2 text-sm"
                  >
                    {template.bodyText ? fillTemplateBody(template.bodyText, vars) : "Esta plantilla no tiene texto."}
                  </p>
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Meta cobra cada plantilla enviada, aunque el cliente no la lea.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!complete || send.isPending}>
                {send.isPending ? "Enviando…" : "Enviar plantilla"}
              </Button>
            </DialogFooter>
          </form>
        )}
        {approved.length === 0 && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
