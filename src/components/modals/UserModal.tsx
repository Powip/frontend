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
        className="!max-w-[calc(100vw-2rem)] md:!max-w-[860px] !w-full max-h-[90vh] overflow-y-auto"
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
