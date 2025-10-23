"use client";
import { useState } from "react";
import { Brand } from "@/interfaces/IProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableActions,
} from "@/components/ui/table";
import { Edit, Trash, Plus } from "lucide-react";
import BrandModal from "../brands/BrandModal";
import BrandDeleteModal from "./BrandDeleteModal";
import { Button } from "../ui/button";

interface Props {
  brands: Brand[];
  supplierId: string;
  onUpdated: () => void;
}

export default function BrandsTable({ brands, supplierId, onUpdated }: Props) {
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | undefined>();

  const handleNew = () => {
    setSelectedBrand(undefined);
    setOpenModal(true);
  };

  const handleEdit = (brand: Brand) => {
    setSelectedBrand(brand);
    setOpenModal(true);
  };

  const handleDelete = (brand: Brand) => {
    setSelectedBrand(brand);
    setOpenDelete(true);
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1" /> Nueva Marca
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.map((brand) => (
            <TableRow key={brand.id}>
              <TableCell>{brand.name}</TableCell>
              <TableCell>{brand.description || "-"}</TableCell>
              <TableActions>
                <Button
                  size="icon"
                  className="bg-lime"
                  onClick={() => handleEdit(brand)}
                >
                  <Edit />
                </Button>
                <Button
                  size="icon"
                  className="bg-red"
                  onClick={() => handleDelete(brand)}
                >
                  <Trash />
                </Button>
              </TableActions>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Modal Crear/Editar */}
      <BrandModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        supplierId={supplierId}
        brand={selectedBrand}
        onSaved={onUpdated}
      />

      {/* Modal Eliminar */}
      <BrandDeleteModal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        brandId={selectedBrand?.id}
        onDeleted={onUpdated}
      />
    </>
  );
}
