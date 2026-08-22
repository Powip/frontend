"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUsuarioEmpresa } from "@/services/superadmin/empresasService";
import { empresasMock } from "@/mocks/superadmin";
import { RolUsuarioEmpresa } from "@/interfaces/superadmin";

const ROLES: RolUsuarioEmpresa[] = ["Administrador", "Vendedor", "Soporte"];

export function CrearUsuarioModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [empresaId, setEmpresaId] = useState(empresasMock[0]?.id ?? "");
  const [rol, setRol] = useState<RolUsuarioEmpresa>("Vendedor");

  const { mutate, isPending } = useMutation({
    mutationFn: createUsuarioEmpresa,
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "usuarios"] });
      toast.success(`Se invitó a ${u.nombre} como ${u.rol}.`);
      onOpenChange(false);
      setNombre("");
      setEmail("");
    },
  });

  function handleSubmit() {
    if (!nombre.trim() || !email.trim() || !empresaId) {
      toast.error("Nombre, email y empresa son obligatorios.");
      return;
    }
    mutate({ nombre: nombre.trim(), email: email.trim(), empresaId, rol });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
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
            <Label className="text-xs font-bold mb-1.5 block">Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {empresasMock.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Rol *</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as RolUsuarioEmpresa)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
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
