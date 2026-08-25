"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ExportButton } from "@/components/superadmin/shared";
import { FiltersBar, SearchInput } from "@/components/superadmin/shared/FiltersBar";
import { UsuariosKpis } from "@/components/superadmin/usuarios/UsuariosKpis";
import { UsuariosTable } from "@/components/superadmin/usuarios/UsuariosTable";
import { CrearUsuarioModal } from "@/components/superadmin/usuarios/CrearUsuarioModal";
import { useUsuariosEmpresaBase, useRolesDisponibles } from "@/hooks/superadmin/useUsuarios";

export default function UsuariosPage() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState("todos");
  const [open, setOpen] = useState(false);

  const { usuarios } = useUsuariosEmpresaBase();
  const { data: roles } = useRolesDisponibles();

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Directorio de usuarios de las empresas — no el equipo interno de POWIP."
        actions={
          <>
            <ExportButton
              filename="usuarios"
              rows={usuarios.map((u) => ({ Nombre: u.nombre, Email: u.email, Empresa: u.empresaNombre, Rol: u.rol, Registro: u.registro }))}
            />
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Invitar usuario
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <UsuariosKpis />
      </div>

      <FiltersBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o email…" />
        <Select value={rol} onValueChange={setRol}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id ?? r.name} value={r.name}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FiltersBar>

      <UsuariosTable q={q} rol={rol} />

      <CrearUsuarioModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
