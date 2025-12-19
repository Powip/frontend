import { Client } from "@/interfaces/ICliente";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import ClienteForm from "../forms/ClienteForm";

interface Props {
  open: boolean;
  onClose: () => void;
  cliente: Client | null;
  onClienteSaved: () => void;
}
export default function ClienteModal({
  open,
  onClose,
  cliente,
  onClienteSaved,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent className="!max-w-[90vw] sm:!max-w-[500px] !w-full">
        <DialogHeader>
          <DialogTitle>
            {cliente ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
        </DialogHeader>
        <ClienteForm cliente={cliente} onClienteSaved={onClienteSaved} />
      </DialogContent>
    </Dialog>
  );
}
