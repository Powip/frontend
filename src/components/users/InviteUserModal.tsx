"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
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
      iconClassName="bg-[#dbeafe]"
      title="Invitar por email"
      subtitle="El colaborador recibe un enlace para activar su cuenta y definir su contraseña"
      footer={
        <>
          <button type="button" className={usersTheme.secondaryButton} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="button" className={usersTheme.primaryButton} disabled aria-describedby={noticeId}>
            Enviar invitación
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <PendingBackendNotice
          id={noticeId}
          title="Invitaciones todavía no habilitadas"
        >
          Podés revisar el formulario, pero todavía no se puede enviar ninguna invitación.
        </PendingBackendNotice>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-email`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Email del colaborador
          </label>
          <Input
            id={`${fieldId}-email`}
            type="email"
            placeholder="colaborador@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={usersTheme.input}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-name`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Nombre completo
          </label>
          <Input
            id={`${fieldId}-name`}
            placeholder="Para personalizar el email de bienvenida"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={usersTheme.input}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-role`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Rol a asignar
          </label>
          <select
            id={`${fieldId}-role`}
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            disabled={!rolesReady}
            className={`h-9 w-full bg-white px-3 dark:bg-transparent ${usersTheme.input}`}
          >
            <option value="">{rolesReady ? "Selecciona el rol" : "Roles no disponibles"}</option>
            {roles.map((role) => (
              <option key={role.id || role.name} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <p className="rounded-[9px] bg-[#f7f6ff] px-3 py-3 text-xs text-[#8b87a3] dark:bg-muted">
          Cuando esta función esté disponible, el colaborador recibirá un enlace de un solo uso para activar su cuenta y
          establecer su contraseña.
        </p>
      </div>
    </UsersModalShell>
  );
}
