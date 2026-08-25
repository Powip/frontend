"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateUsuarioEmpresa, useEmpresasDisponibles, useRolesDisponibles } from "@/hooks/superadmin/useUsuarios";

export function CrearUsuarioModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: empresas } = useEmpresasDisponibles();
  const { data: roles } = useRolesDisponibles();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [rol, setRol] = useState("");

  useEffect(() => {
    if (!empresaId && empresas.length) setEmpresaId(empresas[0].id);
  }, [empresas, empresaId]);
  useEffect(() => {
    if (!rol && roles.length) setRol(roles[0].name);
  }, [roles, rol]);

  const { mutate, isPending } = useCreateUsuarioEmpresa();

  function handleSubmit() {
    if (!nombre.trim() || !email.trim() || !empresaId || !rol) {
      toast.error("Nombre, email, empresa y rol son obligatorios.");
      return;
    }
    mutate(
      { nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim(), empresaId, roleName: rol },
      {
        onSuccess: () => {
          toast.success(`Se creó el usuario ${nombre.trim()}. Sin invitación por email — comparte la contraseña temporal por otro canal.`);
          onOpenChange(false);
          setNombre("");
          setApellido("");
          setEmail("");
        },
        onError: (err: any) => {
          toast.error(err?.message || "No se pudo crear el usuario.");
        },
      }
    );
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
            <Label className="text-xs font-bold mb-1.5 block">Apellido</Label>
            <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
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
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold mb-1.5 block">Rol *</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id ?? r.name} value={r.name}>
                    {r.name}
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
            {isPending ? "Creando…" : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
