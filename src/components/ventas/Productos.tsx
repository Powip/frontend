import { Search, Trash } from "lucide-react";
import { useState } from "react";
import FormGrid from "../ui/form-grid";
import Header from "../ui/header";
import { Input } from "../ui/input";
import Label from "../ui/label";
import { Button } from "../ui/button";
import FormContainer from "../ui/form-container";
import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { AgregarProducto } from "./AgregarProducto";
import Container from "../ui/container";
import { useCatalogoProductos } from "@/src/hooks/useCatalogoProductos";

type Props = {
  next: () => void;
  prev: () => void;
};

export const Productos = ({ next, prev }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const {products} = useCatalogoProductos()

  return (
    <Container>
      <Header>Productos</Header>
      <FormContainer className="border-none py-0">
        <FormGrid>
          <div className="grid grid-cols-4 gap-15 w-full">
            <div className="col-span-3">
              <Label>Producto</Label>
              <Input icon={Search} iconPosition="right" />
            </div>
            <Button
              className="col-span-1 self-end"
              onClick={() => setIsOpen(true)}
            >
              Agregar Producto
            </Button>
          </div>
        </FormGrid>
      </FormContainer>

      <div>
        <h2 className="font-medium px-8">Carrito de compras:</h2>
      </div>
      <div className="px-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-gray-50">
              <TableCell>Value</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Value</TableCell>
              <TableActions>
                <Button variant="table" size="icon" className="bg-red">
                  <Trash />
                </Button>
              </TableActions>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-4 gap-15 w-full">
        <Button
          onClick={prev}
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>
        <Button onClick={next} className="col-span-3">
          Siguiente
        </Button>
      </div>

      {isOpen && <AgregarProducto products={products} onClose={() => setIsOpen(false)} />}
    </Container>
  );
};
