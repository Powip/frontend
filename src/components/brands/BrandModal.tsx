"use client";
import { useState, useEffect } from "react";
import { Input } from "@/src/components/ui/input";
import Label from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";
import { Brand } from "@/src/interfaces/IProvider";
import { createBrand, updateBrand } from "@/src/services/brandService";
import { Modal } from "@/src/components/ui/modal";

interface BrandModalProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  brand?: Brand;
  onSaved: () => void;
}

export default function BrandModal({
  open,
  onClose,
  supplierId,
  brand,
  onSaved,
}: BrandModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const isEditing = !!brand;

  useEffect(() => {
    if (brand) {
      setName(brand.name);
      setDescription(brand.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [brand]);

  const handleSubmit = async () => {
    try {
      if (!name.trim()) {
        toast.error("El nombre es obligatorio");
        return;
      }

      if (isEditing) {
        const payload = { name, description };
        await updateBrand(brand!.id, payload);
        toast.success("Marca actualizada correctamente");
      } else {
        const payload = { name, description, supplier_id: supplierId };
        await createBrand(payload);
        toast.success("Marca creada correctamente");
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la marca");
    }
  };

  return (
    <Modal
      title={isEditing ? "Editar Marca" : "Nueva Marca"}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-4 mt-2">
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
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit}>
          {isEditing ? "Guardar cambios" : "Guardar"}
        </Button>
      </div>
    </Modal>
  );
}
