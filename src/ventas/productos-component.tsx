import { Search, Trash } from "lucide-react";
import FormGrid from "../components/ui/form-grid";
import Header from "../components/ui/header";
import { Input } from "../components/ui/input";
import Label from "../components/ui/label";
import { Button } from "../components/ui/button";
import FormContainer from "../components/ui/form-container";
import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import ModalContainer from "../components/ui/modal-container";

export const ProductosComponent = () => {
  return (
    <ModalContainer>
      <Header>Productos</Header>
      <FormContainer className="border-none py-0">
        <FormGrid>
         
          <div className="grid grid-cols-4 gap-15 w-full">
            <div className="col-span-3">
            <Label>Producto</Label>
            <Input icon={Search} iconPosition="right" />
          </div>
            <Button className="col-span-1 self-end">Agregar Producto</Button>
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
            <TableRow className=" hover:bg-gray-50">
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
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>
        <Button className="col-span-3">Siguiente</Button>
      </div>
    </ModalContainer>
  );
};
