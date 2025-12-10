import { Cliente } from "@/interfaces/ICliente";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  cliente: Cliente;
}
export default function ClienteModal({ open, onClose, cliente }: Props) {
  <Dialog open={open} onOpenChange={(open) => (!open ? onClose() : undefined)}>
    <DialogContent className="!max-w-[90vw] sm:!max-w-[500px] !w-full">
      <DialogHeader>
        <DialogTitle>
          {cliente ? "Editar Cliente" : "Nuevo Cliente"}
        </DialogTitle>
      </DialogHeader>
      {/* form */}
    </DialogContent>
  </Dialog>;
}
