import AlmacenForm from "../forms/AlmacenForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}
export default function AlmacenModal({ open, onClose, onSaved }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <DialogContent className="!max-w-[90vw] sm:!max-w-[500px] !w-full">
        <DialogHeader>
          <DialogTitle>Almacén</DialogTitle>
        </DialogHeader>
        <AlmacenForm onClienteSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
