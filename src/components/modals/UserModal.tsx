"use client";

import { useState } from "react";
import { User } from "@/interfaces/IUser";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
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
        className={`!max-w-[calc(100vw-2rem)] !w-full max-h-[90vh] overflow-y-auto rounded-2xl ${
          user ? "sm:!max-w-[580px]" : "md:!max-w-[820px]"
        }`}
        showCloseButton={!saving}
      >
        <DialogHeader className="-mx-6 -mt-6 flex-row items-start gap-2.5 space-y-0 border-b border-[#e8e4f8] px-[22px] pb-3.5 pt-[18px] text-left dark:border-border">
          <div
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-lg ${
              user ? "bg-[#e6f7f7]" : "bg-[#f0eeff]"
            }`}
          >
            {user ? "✏️" : "👤"}
          </div>
          <div className="pr-6">
            <DialogTitle className="text-[15px] font-extrabold text-[#0e0b1f] dark:text-foreground">
              {user ? `Editar — ${user.name} ${user.surname}` : "Crear nuevo usuario"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-[#8b87a3]">
              {user ? "Modifica datos, rol o permisos" : "Define datos, rol y permisos específicos"}
            </DialogDescription>
          </div>
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
