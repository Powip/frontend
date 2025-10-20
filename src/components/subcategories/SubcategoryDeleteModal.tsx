"use client";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";
import { inactivateSubcategory } from "@/src/services/subcategoryService";
import { Modal } from "../ui/modal";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  subcategoryId?: string;
  onDeleted: () => void;
}

export default function DeleteSubcategoryModal({
  open,
  onClose,
  subcategoryId,
  onDeleted,
}: ConfirmDeleteModalProps) {
  const handleDelete = async () => {
    if (!subcategoryId) return;
    try {
      await inactivateSubcategory(subcategoryId);
      toast.success("Subcategoría eliminada correctamente");
      onDeleted();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la Subcategoría");
    }
  };

  return (
    <Modal title="Eliminar Subcategoría" open={open} onClose={onClose}>
      <p className="mt-2">¿Confirma la eliminación de la subcategoría?</p>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="default" onClick={handleDelete}>
          Eliminar
        </Button>
      </div>
    </Modal>
  );
}
