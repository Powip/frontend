import AlmacenForm from "../forms/AlmacenForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

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
          <DialogTitle>Nuevo almacén</DialogTitle>
          <DialogDescription>
            El almacén es de la empresa y se puede compartir entre tiendas. La tienda
            seleccionada queda como su tienda de origen.
          </DialogDescription>
        </DialogHeader>
        <AlmacenForm onClienteSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
