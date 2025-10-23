"use client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { inactivateBrand } from "@/services/brandService";
import { Modal } from "@/components/ui/modal";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  brandId?: string;
  onDeleted: () => void;
}

export default function BrandDeleteModal({
  open,
  onClose,
  brandId,
  onDeleted,
}: ConfirmDeleteModalProps) {
  const handleDelete = async () => {
    if (!brandId) return;
    try {
      await inactivateBrand(brandId);
      toast.success("Marca eliminada correctamente");
      onDeleted();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la marca");
    }
  };

  return (
    <Modal title="Eliminar Marca" open={open} onClose={onClose}>
      <p className="mt-2">¿Confirma la eliminación de esta marca?</p>
      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="default" onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Modal>
  );
}
