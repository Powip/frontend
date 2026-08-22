"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLead } from "@/hooks/superadmin/useAdquisicion";
import { CanalAdquisicion } from "@/interfaces/superadmin";

const CANALES_ADQ: { value: CanalAdquisicion; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "landing", label: "Landing" },
  { value: "google_form", label: "Google Form" },
  { value: "referido", label: "Referido" },
  { value: "otro", label: "Otro" },
];

export function NuevoProspectoModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { mutate, isPending } = useCreateLead();
  const [nombre, setNombre] = useState("");
  const [negocio, setNegocio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [canalAdquisicion, setCanalAdquisicion] = useState<CanalAdquisicion>("landing");
  const [sdrNombre, setSdrNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [tipoProductos, setTipoProductos] = useState("");
  const [pedidosDia, setPedidosDia] = useState("");
  const [planInteres, setPlanInteres] = useState("");
  const [courier, setCourier] = useState("");
  const [interesadoEn, setInteresadoEn] = useState("");
  const [observaciones, setObservaciones] = useState("");

  function resetForm() {
    setNombre("");
    setNegocio("");
    setWhatsapp("");
    setEmail("");
    setRubro("");
    setTipoProductos("");
    setPedidosDia("");
    setPlanInteres("");
    setCourier("");
    setInteresadoEn("");
    setObservaciones("");
  }

  function handleSubmit() {
    if (!nombre.trim() || !whatsapp.trim()) {
      toast.error("Persona de contacto y WhatsApp son obligatorios.");
      return;
    }
    mutate(
      {
        nombre: nombre.trim(),
        negocio: negocio.trim() || undefined,
        whatsapp: whatsapp.trim(),
        email: email.trim() || undefined,
        canalAdquisicion,
        sdrNombre: sdrNombre.trim() || undefined,
        rubro: rubro.trim() || undefined,
        tipoProductos: tipoProductos.trim() || undefined,
        pedidosDia: pedidosDia ? Number(pedidosDia) : undefined,
        planInteres: planInteres || undefined,
        courier: courier.trim() || undefined,
        interesadoEn: interesadoEn.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      },
      {
        onSuccess: (lead) => {
          toast.success(`${lead.negocio || lead.nombre} se registró en "Sin abordar".`);
          onOpenChange(false);
          resetForm();
        },
        onError: () => toast.error("No se pudo registrar el prospecto — reintentá en unos segundos."),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Prospecto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-[11px] text-muted-foreground -mt-2">
            Rubro, tipo de productos y canales de venta todavía no tienen columna propia en el backend — quedan guardados como nota en el
            historial del lead.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Persona de contacto *">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Negocio">
              <Input value={negocio} onChange={(e) => setNegocio(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp *">
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+51 9XX XXX XXX" />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Canal de adquisición">
              <Select value={canalAdquisicion} onValueChange={(v) => setCanalAdquisicion(v as CanalAdquisicion)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANALES_ADQ.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsable (SDR)">
              <Input value={sdrNombre} onChange={(e) => setSdrNombre(e.target.value)} placeholder="Nombre del vendedor" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Rubro">
              <Input value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder="Ej. Cosmética" />
            </Field>
            <Field label="Tipos de productos">
              <Input value={tipoProductos} onChange={(e) => setTipoProductos(e.target.value)} placeholder="Ej. ropa, accesorios" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Pedidos/día">
              <Input type="number" min={0} value={pedidosDia} onChange={(e) => setPedidosDia(e.target.value)} />
            </Field>
            <Field label="Plan de interés">
              <Select value={planInteres} onValueChange={setPlanInteres}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {["Basic", "Pro", "Scale", "Enterprise"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Courier">
              <Input value={courier} onChange={(e) => setCourier(e.target.value)} />
            </Field>
          </div>

          <Field label="Interesado en">
            <Input value={interesadoEn} onChange={(e) => setInteresadoEn(e.target.value)} placeholder="Ej. Módulo SUNAT" />
          </Field>

          <Field label="Observaciones">
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando…" : "Registrar prospecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-bold mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
