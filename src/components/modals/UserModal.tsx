"use client";

import { useState } from "react";
import { User } from "@/interfaces/IUser";
import { Dialog, DialogContent } from "../ui/dialog";
import UserForm from "../forms/UserForm";
import { UsersDialogHeader, usersDialogContentClass } from "../users/UsersModalShell";

interface UserModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onUserSaved: () => void;
}

export default function UserModal({
  open,
  onClose,
  user,
  onUserSaved,
}: UserModalProps) {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
    >
      <DialogContent className={usersDialogContentClass(user ? "md" : "lg")} showCloseButton={!saving}>
        <UsersDialogHeader
          icon={user ? "✏️" : "👤"}
          iconClassName={user ? "bg-teal-100 dark:bg-teal-500/20" : "bg-violet-100 dark:bg-violet-500/20"}
          title={user ? `Editar — ${user.name} ${user.surname}` : "Crear nuevo usuario"}
          subtitle={user ? "Modifica datos, rol o permisos" : "Define datos, rol y permisos específicos"}
        />
        <UserForm
          key={user?.id ?? "new"}
          user={user}
          onUserSaved={onUserSaved}
          onCancel={onClose}
          onSavingChange={setSaving}
        />
      </DialogContent>
    </Dialog>
  );
}
