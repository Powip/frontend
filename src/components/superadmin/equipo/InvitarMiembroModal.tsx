"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInvitarMiembro } from "@/hooks/superadmin/useEquipo";
import { ROL_LABEL, RolInterno } from "@/interfaces/superadmin";

const ROLES: RolInterno[] = ["super", "ventas", "soporte", "onboarding", "finanzas", "csm"];

export function InvitarMiembroModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolInterno>("ventas");

  const { mutate, isPending } = useInvitarMiembro();

  function handleSuccess(m: { nombre: string; rol: RolInterno }) {
    toast.success(`Se invitó a ${m.nombre} como ${ROL_LABEL[m.rol]}.`);
    onOpenChange(false);
    setNombre("");
    setEmail("");
    setRol("ventas");
  }

  function handleSubmit() {
    if (!nombre.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios.");
      return;
    }
    mutate({ nombre: nombre.trim(), email: email.trim(), rol }, { onSuccess: handleSuccess });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Rol *</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as RolInterno)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROL_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Invitando…" : "Invitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
