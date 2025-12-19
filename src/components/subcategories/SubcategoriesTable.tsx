/* "use client";
import { useState } from "react";
import { Subcategory } from "@/interfaces/ICategory";
import { Button } from "@/components/ui/button";

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
import SubcategoryModal from "./SubcategoryModal";
import SubcategoryDeleteModal from "./SubcategoryDeleteModal";

interface Props {
  subcategories: Subcategory[];
  categoryId: string;
  onUpdated: () => void;
}

export default function SubcategoriesTable({
  subcategories,
  categoryId,
  onUpdated,
}: Props) {
  const [openModal, setOpenModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [selectedSubcat, setSelectedSubcat] = useState<
    Subcategory | undefined
  >();

  const handleNew = () => {
    setSelectedSubcat(undefined);
    setOpenModal(true);
  };

  const handleEdit = (subcategory: Subcategory) => {
    setSelectedSubcat(subcategory);
    setOpenModal(true);
  };

  const handleDelete = (subcategory: Subcategory) => {
    setSelectedSubcat(subcategory);
    setOpenDelete(true);
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1" /> Nueva Subcategoría
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subcategories.map((subcat) => (
            <TableRow key={subcat.id}>
              <TableCell>{subcat.name}</TableCell>
              <TableCell>{subcat.description || "-"}</TableCell>
              <TableCell>{subcat.sku || "-"}</TableCell>
              <TableActions>
                <Button
                  size="icon"
                  className="bg-lime"
                  onClick={() => handleEdit(subcat)}
                >
                  <Edit />
                </Button>
                <Button
                  size="icon"
                  className="bg-red"
                  onClick={() => handleDelete(subcat)}
                >
                  <Trash />
                </Button>
              </TableActions>
            </TableRow>
          ))}
        </TableBody>
      </Table>


      <SubcategoryModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        categoryId={categoryId}
        subcategory={selectedSubcat}
        onSaved={onUpdated}
      />


      <SubcategoryDeleteModal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        subcategoryId={selectedSubcat?.id}
        onDeleted={onUpdated}
      />
    </>
  );
}
 */
