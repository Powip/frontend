import InventarioForm from "../forms/InventarioModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}
export default function InventarioModal({ open, onClose, onSaved }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent className="!max-w-[90vw] sm:!max-w-[500px] !w-full">
        <DialogHeader>
          <DialogTitle></DialogTitle>
        </DialogHeader>
        <InventarioForm onClienteSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
