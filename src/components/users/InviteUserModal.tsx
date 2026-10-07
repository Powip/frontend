"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/interfaces/IUser";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { UsersModalShell } from "./UsersModalShell";
import { usersTheme } from "./usersTheme";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  rolesReady: boolean;
}

export function InviteUserModal({ open, onOpenChange, roles, rolesReady }: InviteUserModalProps) {
  const fieldId = useId();
  const noticeId = `${fieldId}-pending`;
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleName, setRoleName] = useState("");

  return (
    <UsersModalShell
      open={open}
      onOpenChange={onOpenChange}
      icon="📧"
      iconClassName="bg-blue-100 dark:bg-blue-500/20"
      title="Invitar por email"
      subtitle="El colaborador recibe un enlace para activar su cuenta y definir su contraseña"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled aria-describedby={noticeId}>
            Enviar invitación
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PendingBackendNotice id={noticeId} title="Invitaciones todavía no habilitadas">
          Podés revisar el formulario, pero todavía no se puede enviar ninguna invitación.
        </PendingBackendNotice>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-email`} className={usersTheme.requiredMark}>
            Email del colaborador
          </Label>
          <Input
            id={`${fieldId}-email`}
            type="email"
            placeholder="colaborador@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-name`} className={usersTheme.requiredMark}>
            Nombre completo
          </Label>
          <Input
            id={`${fieldId}-name`}
            placeholder="Para personalizar el email de bienvenida"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-role`} className={usersTheme.requiredMark}>
            Rol a asignar
          </Label>
          <select
            id={`${fieldId}-role`}
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            disabled={!rolesReady}
            aria-describedby={`${fieldId}-role-hint`}
            className={usersTheme.nativeSelect}
          >
            <option value="">{rolesReady ? "Selecciona el rol" : "Roles no disponibles"}</option>
            {roles.map((role) => (
              <option key={role.id || role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
          <p id={`${fieldId}-role-hint`} className={usersTheme.fieldHint}>
            El colaborador recibirá un enlace de un solo uso para activar su cuenta y definir su contraseña.
          </p>
        </div>
      </div>
    </UsersModalShell>
  );
}
