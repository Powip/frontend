"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrearCampana } from "@/hooks/superadmin/useCampanas";
import { CanalCampana } from "@/interfaces/superadmin";

export function NuevaCampanaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [nombre, setNombre] = useState("");
  const [segmento, setSegmento] = useState("");
  const [canal, setCanal] = useState<CanalCampana>("WhatsApp");
  const [mensaje, setMensaje] = useState("");

  const { mutate, isPending } = useCrearCampana();

  function handleSubmit() {
    if (!nombre.trim() || !segmento.trim() || !mensaje.trim()) {
      toast.error("Nombre, segmento y mensaje son obligatorios.");
      return;
    }
    mutate(
      { nombre: nombre.trim(), segmento: segmento.trim(), canal, mensaje: mensaje.trim() },
      {
        onSuccess: (c) => {
          toast.success(`Campaña "${c.nombre}" creada como borrador.`);
          onOpenChange(false);
          setNombre("");
          setSegmento("");
          setMensaje("");
          setCanal("WhatsApp");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva campaña</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Reactivación trials vencidos" />
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Segmento *</Label>
            <Input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ej. Trial vencido, 30-60 días" />
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Canal *</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as CanalCampana)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Mensaje / plantilla *</Label>
            <Textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Hola {{nombre}}, ..." />
          </div>
          {canal === "WhatsApp" && (
            <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2.5">
              WhatsApp usa plantillas aprobadas (UTILITY/MARKETING); respeta opt-out.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Creando…" : "Crear campaña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
