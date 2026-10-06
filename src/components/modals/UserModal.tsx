"use client";

import { useState } from "react";
import { User } from "@/interfaces/IUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import UserForm from "../forms/UserForm";

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
      <DialogContent
        className="!max-w-[90vw] sm:!max-w-[600px] !w-full"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>
            {user ? "Editar Usuario" : "Nuevo Usuario"}
          </DialogTitle>
        </DialogHeader>
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
