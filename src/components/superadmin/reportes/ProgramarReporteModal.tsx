"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReportesDisponibles, useCrearReporteProgramado } from "@/hooks/superadmin/useReportes";
import { IReporteProgramado } from "@/interfaces/superadmin";

const FRECUENCIAS: IReporteProgramado["frecuencia"][] = ["Diario", "Semanal", "Mensual"];

export function ProgramarReporteModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: reportes } = useReportesDisponibles();

  const [reporte, setReporte] = useState("");
  const [frecuencia, setFrecuencia] = useState<IReporteProgramado["frecuencia"]>("Semanal");
  const [destinatario, setDestinatario] = useState("");

  const { mutate, isPending } = useCrearReporteProgramado();

  function handleSubmit() {
    if (!reporte || !destinatario.trim()) {
      toast.error("Reporte y destinatario son obligatorios.");
      return;
    }
    mutate(
      { reporte, frecuencia, destinatario: destinatario.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReporte("");
          setDestinatario("");
          setFrecuencia("Semanal");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Programar reporte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Reporte *</Label>
            <Select value={reporte} onValueChange={setReporte}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un reporte" />
              </SelectTrigger>
              <SelectContent>
                {(reportes ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.nombre}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Frecuencia *</Label>
            <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as IReporteProgramado["frecuencia"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRECUENCIAS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Destinatario *</Label>
            <Input type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="nombre@powip.pe" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Programando…" : "Programar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
