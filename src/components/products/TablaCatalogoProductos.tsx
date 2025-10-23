"use client";

import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash } from "lucide-react";
import { IProduct } from "./interfaces";

interface Props {
  products: IProduct[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}

export default function ProductsTable({
  products,
  onDelete,
  onEdit,
  onView,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Precio Venta</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead>Proveedor</TableHead>
          <TableHead>Subcategoría</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>{product.sku}</TableCell>
            <TableCell>{product.name}</TableCell>
            <TableCell>{product.priceBase}</TableCell>
            <TableCell>{product.priceVta}</TableCell>
            <TableCell>{product.brand?.name}</TableCell>
            <TableCell>{product.company?.name}</TableCell>
            <TableCell>{product.subcategory?.name}</TableCell>
            <TableCell>{product.category?.name}</TableCell>
            <TableActions>
              <Button
                variant="table"
                size="icon"
                className="bg-lime"
                onClick={() => onEdit(product.id)}
              >
                <Edit />
              </Button>
              <Button
                variant="table"
                size="icon"
                className="bg-red"
                onClick={() => onDelete(product.id)}
              >
                <Trash />
              </Button>
              <Button
                variant="table"
                size="icon"
                className="bg-sky-blue"
                onClick={() => onView(product.id)}
              >
                <Eye />
              </Button>
            </TableActions>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
