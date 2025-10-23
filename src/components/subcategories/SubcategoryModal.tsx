"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import Label from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { Subcategory } from "@/interfaces/ICategory";
import {
  createSubcategory,
  updateSubcategory,
} from "@/services/subcategoryService";
import { Modal } from "@/components/ui/modal";

interface SubcatModalProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  subcategory?: Subcategory;
  onSaved: () => void;
}

export default function SubcategoryModal({
  open,
  onClose,
  categoryId,
  subcategory,
  onSaved,
}: SubcatModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const isEditing = !!subcategory;

  useEffect(() => {
    if (subcategory) {
      setName(subcategory.name);
      setDescription(subcategory.description || "");
      setSku(subcategory.sku || "");
    } else {
      setName("");
      setDescription("");
      setSku("");
    }
  }, [subcategory]);

  const handleSubmit = async () => {
    try {
      if (!name.trim()) {
        toast.error("El nombre es obligatorio");
        return;
      }

      // 🧩 Payload único para crear o editar
      const payload = {
        name,
        description,
        sku,
        categoryId,
        status: true,
      };

      if (isEditing) {
        await updateSubcategory(subcategory!.id, payload);
        toast.success("Subcategoría actualizada correctamente");
      } else {
        await createSubcategory(payload);
        toast.success("Subcategoría creada correctamente");
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la subcategoría");
    }
  };

  return (
    <Modal
      title={subcategory ? "Editar Subcategoría" : "Nueva Subcategoría"}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <Label>Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
          />
        </div>
        <div>
          <Label>Descripción</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción"
          />
        </div>
        <div>
          <Label>SKU</Label>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Guardar cambios" : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
