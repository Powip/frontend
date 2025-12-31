"use client";

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
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent className="!max-w-[90vw] sm:!max-w-[600px] !w-full">
        <DialogHeader>
          <DialogTitle>
            {user ? "Editar Usuario" : "Nuevo Usuario"}
          </DialogTitle>
        </DialogHeader>
        <UserForm user={user} onUserSaved={onUserSaved} />
      </DialogContent>
    </Dialog>
  );
}
