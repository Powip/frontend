"use client";

import { useId } from "react";
import type { RoleOption } from "@/services/userListing";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { PermissionMatrix } from "./PermissionMatrix";
import { UsersModalShell } from "./UsersModalShell";
import { roleStyle, usersTheme } from "./usersTheme";

interface EditPermissionsModalProps {
  role: RoleOption | null;
  onOpenChange: (open: boolean) => void;
}

export function EditPermissionsModal({ role, onOpenChange }: EditPermissionsModalProps) {
  const noticeId = `${useId()}-pending`;
  const style = roleStyle(role?.name);

  return (
    <UsersModalShell
      open={!!role}
      onOpenChange={onOpenChange}
      size="lg"
      icon={style.icon}
      iconClassName={style.tile}
      title={role ? `Editar permisos — ${role.label}` : "Editar permisos"}
      subtitle="Define a qué módulos y acciones accede este rol"
      footer={
        <>
          <button type="button" className={usersTheme.secondaryButton} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="button" className={usersTheme.primaryButton} disabled aria-describedby={noticeId}>
            Guardar permisos
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <PendingBackendNotice
          id={noticeId}
          title="Edición de permisos todavía no habilitada"
        >
          Todavía no se pueden ver ni modificar los permisos de este rol. Esta pantalla muestra cómo se verá.
        </PendingBackendNotice>
        <PermissionMatrix caption={role ? `Permisos del rol ${role.label}` : "Permisos del rol"} />
      </div>
    </UsersModalShell>
  );
}
