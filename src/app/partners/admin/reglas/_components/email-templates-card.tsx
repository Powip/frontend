"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEMPLATES = [
  {
    id: "tpl-activacion",
    title: "Invitación de activación",
    description: "Se envía al registrar el referido",
    subject: "Activa tu cuenta POWIP — 10% de descuento te espera",
  },
  {
    id: "tpl-bienvenida",
    title: "Bienvenida con descuento",
    description: "Al crear su cuenta",
    subject: "¡Bienvenido a POWIP! Tu descuento ya está activo",
  },
  {
    id: "tpl-recordatorio",
    title: "Recordatorio",
    description: "Si no activa en 3 días",
    subject: "Todavía podés activar tu cuenta POWIP",
  },
];

const DEFAULT_BODY = `Hola {nombre_negocio},

{nombre_partner} te invitó a POWIP para centralizar tus pedidos. Activa tu cuenta con este enlace y obtén tu descuento:

{link_activacion}

Tu código: {codigo}`;

export function EmailTemplatesCard() {
  const [openTemplate, setOpenTemplate] = useState<(typeof TEMPLATES)[number] | null>(null);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Plantillas de correo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setOpenTemplate(template)}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <div>
              <div className="font-medium text-foreground">{template.title}</div>
              <div className="text-xs text-muted-foreground">{template.description}</div>
            </div>
          </button>
        ))}
      </CardContent>

      <Dialog open={openTemplate !== null} onOpenChange={(open) => !open && setOpenTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plantilla · {openTemplate?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Asunto</Label>
              <Input id="tpl-subject" defaultValue={openTemplate?.subject} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Cuerpo</Label>
              <textarea
                id="tpl-body"
                rows={7}
                defaultValue={DEFAULT_BODY}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Variables: {"{nombre_negocio}"}, {"{nombre_partner}"}, {"{link_activacion}"}, {"{codigo}"},{" "}
              {"{descuento}"}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenTemplate(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setOpenTemplate(null);
                toast.success("Plantilla guardada");
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
