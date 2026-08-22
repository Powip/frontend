"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgendarDemo } from "@/hooks/superadmin/useAdquisicion";

interface Props {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function AgendarDemoModal({ leadId, onOpenChange }: Props) {
  const { mutate, isPending } = useAgendarDemo();
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("10:00");
  const [sdrNombre, setSdrNombre] = useState("");
  const [tipo, setTipo] = useState<"venta" | "onboarding">("venta");

  return (
    <Dialog open={!!leadId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agendar demo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">SDR</Label>
            <Input value={sdrNombre} onChange={(e) => setSdrNombre(e.target.value)} placeholder="Nombre del vendedor" />
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "venta" | "onboarding")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venta">Venta</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={isPending || !leadId || !sdrNombre.trim()}
            onClick={() =>
              mutate(
                { leadId: leadId!, fecha: new Date(`${fecha}T${hora}`).toISOString(), hora, sdrNombre: sdrNombre.trim(), tipo },
                {
                  onSuccess: () => {
                    toast.success(`Demo agendada para ${new Date(fecha).toLocaleDateString("es-PE")}.`);
                    onOpenChange(false);
                  },
                  onError: () => toast.error("No se pudo agendar la demo — reintentá."),
                }
              )
            }
          >
            {isPending ? "Agendando…" : "Agendar demo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
