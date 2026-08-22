"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEmpresa } from "@/hooks/superadmin/useEmpresas";
import { CanalVenta } from "@/interfaces/superadmin";
import { cn } from "@/lib/utils";

const CANALES: CanalVenta[] = ["WhatsApp", "Web", "TikTok", "TikTok Live", "Instagram", "Shopify", "Mercado Libre", "Falabella", "Ripley"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (empresaId: string) => void;
}

/**
 * El alta real es un flujo de 2 pasos (ver docs/superadmin/empresas-endpoints.md):
 * primero se crea el usuario dueño en ms-auth, después la empresa en ms-company
 * con ese userId. No hay forma de crear una empresa sin dueño.
 */
export function AltaEmpresaModal({ open, onOpenChange, onCreated }: Props) {
  const { mutate, isPending } = useCreateEmpresa();

  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");
  const [telefono, setTelefono] = useState("");
  const [canales, setCanales] = useState<CanalVenta[]>([]);

  const [dueñoNombre, setDueñoNombre] = useState("");
  const [dueñoApellido, setDueñoApellido] = useState("");
  const [dueñoEmail, setDueñoEmail] = useState("");
  const [dueñoDocumento, setDueñoDocumento] = useState("");
  const [dueñoTelefono, setDueñoTelefono] = useState("");

  function toggleCanal(c: CanalVenta) {
    setCanales((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function reset() {
    setNombre("");
    setRuc("");
    setTelefono("");
    setCanales([]);
    setDueñoNombre("");
    setDueñoApellido("");
    setDueñoEmail("");
    setDueñoDocumento("");
    setDueñoTelefono("");
  }

  function handleSubmit() {
    if (!nombre.trim() || !dueñoNombre.trim() || !dueñoApellido.trim() || !dueñoEmail.trim() || !dueñoDocumento.trim()) {
      toast.error("Nombre del negocio y los datos del dueño (nombre, apellido, email, documento) son obligatorios.");
      return;
    }
    mutate(
      {
        nombre: nombre.trim(),
        ruc: ruc.trim() || undefined,
        telefono: telefono.trim() || undefined,
        canalesVenta: canales,
        dueñoNombre: dueñoNombre.trim(),
        dueñoApellido: dueñoApellido.trim(),
        dueñoEmail: dueñoEmail.trim(),
        dueñoDocumento: dueñoDocumento.trim(),
        dueñoTelefono: dueñoTelefono.trim() || undefined,
      },
      {
        onSuccess: (empresa) => {
          toast.success(`${empresa.name} fue dada de alta correctamente.`);
          onOpenChange(false);
          onCreated?.(empresa.id);
          reset();
        },
        onError: (err: Error) => toast.error(err.message || "No se pudo crear la empresa — reintentá."),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dar de alta negocio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Nombre del negocio *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Bella Piel Cosmética" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold mb-1.5 block">RUC</Label>
              <Input value={ruc} onChange={(e) => setRuc(e.target.value)} placeholder="20xxxxxxxxx" />
            </div>
            <div>
              <Label className="text-xs font-bold mb-1.5 block">Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold mb-1.5 block">Canales donde vende</Label>
            <div className="flex flex-wrap gap-1.5">
              {CANALES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCanal(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                    canales.includes(c) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs font-bold mb-1.5 block">Dueño de la cuenta *</Label>
            <p className="text-[11px] text-muted-foreground mb-2.5">
              ms-company exige que la empresa tenga un usuario dueño ya creado — se crea acá mismo en el mismo paso.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input value={dueñoNombre} onChange={(e) => setDueñoNombre(e.target.value)} placeholder="Nombre" />
              <Input value={dueñoApellido} onChange={(e) => setDueñoApellido(e.target.value)} placeholder="Apellido" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input type="email" value={dueñoEmail} onChange={(e) => setDueñoEmail(e.target.value)} placeholder="Email" />
              <Input value={dueñoDocumento} onChange={(e) => setDueñoDocumento(e.target.value)} placeholder="DNI/documento" />
            </div>
            <Input className="mt-3" value={dueñoTelefono} onChange={(e) => setDueñoTelefono(e.target.value)} placeholder="Teléfono (opcional)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Creando…" : "Dar de alta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
