"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { RoleOption } from "@/services/userListing";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { PermissionMatrix } from "./PermissionMatrix";
import { UsersModalShell } from "./UsersModalShell";
import { roleStyle } from "./usersTheme";

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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled aria-describedby={noticeId}>
            Guardar permisos
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PendingBackendNotice id={noticeId} title="Edición de permisos todavía no habilitada">
          Todavía no se pueden ver ni modificar los permisos de este rol. La matriz usa rutas de ejemplo.
        </PendingBackendNotice>
        <PermissionMatrix caption={role ? `Permisos del rol ${role.label}` : "Permisos del rol"} />
      </div>
    </UsersModalShell>
  );
}
