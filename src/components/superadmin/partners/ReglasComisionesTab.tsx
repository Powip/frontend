"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, ShieldCheck, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getConfigPrograma, actualizarConfigPrograma } from "@/services/superadmin/partnersService";
import { SectionHeader, TableSkeleton } from "@/components/superadmin/shared";
import { IConfigPrograma } from "@/interfaces/superadmin";

export function ReglasComisionesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "partners", "config"], queryFn: getConfigPrograma });
  const [form, setForm] = useState<IConfigPrograma | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const { mutate: guardar, isPending } = useMutation({
    mutationFn: (input: IConfigPrograma) => actualizarConfigPrograma(input),
    onSuccess: (config) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "partners", "config"] });
      setForm(config);
      toast.success("Cambio registrado en Auditoría.");
    },
  });

  if (isLoading || !form) return <TableSkeleton rows={6} cols={3} />;

  function updateOpcion(id: "A" | "B" | "C", field: "firstPct" | "recPct", value: number) {
    setForm((prev) => (prev ? { ...prev, opciones: prev.opciones.map((o) => (o.id === id ? { ...o, [field]: value } : o)) } : prev));
  }

  return (
    <div>
      <SectionHeader title="Opciones de comisión" sub="Porcentaje sobre el 1er mes y sobre el recurrente, por opción de acuerdo" />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {form.opciones.map((o) => (
          <div key={o.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 text-sm font-extrabold">Opción {o.id}</div>
            <div className="space-y-3">
              <div>
                <Label className="mb-1 text-[11px] text-muted-foreground">1er mes (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={o.firstPct}
                  onChange={(e) => updateOpcion(o.id, "firstPct", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="mb-1 text-[11px] text-muted-foreground">Recurrente (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={o.recPct}
                  onChange={(e) => updateOpcion(o.id, "recPct", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionHeader title="Parámetros del programa" />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField
          label="Descuento máximo del partner (%)"
          value={form.descuentoMaxPct}
          onChange={(v) => setForm({ ...form, descuentoMaxPct: v })}
        />
        <NumberField
          label="Ventana de atribución (días)"
          value={form.ventanaAtribucionDias}
          onChange={(v) => setForm({ ...form, ventanaAtribucionDias: v })}
        />
        <NumberField
          label="Umbral mínimo (S/)"
          value={form.umbralMinimo}
          onChange={(v) => setForm({ ...form, umbralMinimo: v })}
        />
        <NumberField
          label="Retención (%)"
          value={form.retencionPct}
          onChange={(v) => setForm({ ...form, retencionPct: v })}
        />
        <NumberField
          label="Nivel Plata — MRR mínimo (S/)"
          value={form.nivelPlataMrr}
          onChange={(v) => setForm({ ...form, nivelPlataMrr: v })}
        />
        <NumberField
          label="Nivel Oro — MRR mínimo (S/)"
          value={form.nivelOroMrr}
          onChange={(v) => setForm({ ...form, nivelOroMrr: v })}
        />
      </div>

      <SectionHeader title="Controles" />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs font-bold">Anti-fraude</div>
              <div className="text-[11px] text-muted-foreground">Bloquea auto-referidos y duplicados por email/whatsapp.</div>
            </div>
          </div>
          <Switch checked={form.antiFraude} onCheckedChange={(v) => setForm({ ...form, antiFraude: v })} />
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs font-bold">Clawback</div>
              <div className="text-[11px] text-muted-foreground">Reversa comisiones si el referido cancela dentro de la ventana.</div>
            </div>
          </div>
          <Switch checked={form.clawback} onCheckedChange={(v) => setForm({ ...form, clawback: v })} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5" disabled={isPending} onClick={() => guardar(form)}>
          <Save className="h-3.5 w-3.5" />
          Guardar cambios
        </Button>
        {data && (
          <Button size="sm" variant="outline" onClick={() => setForm(data)} disabled={isPending}>
            Descartar cambios
          </Button>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <Label className="mb-1.5 text-[11px] text-muted-foreground">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 text-xs" />
    </div>
  );
}
