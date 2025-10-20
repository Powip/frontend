// src/components/ui/modal.tsx
import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

interface ModalProps {
  title: string;
  children: ReactNode;
  open?: boolean;
  onClose: () => void;
}

export const Modal = ({
  title,
  children,
  open = true,
  onClose,
}: ModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
};
