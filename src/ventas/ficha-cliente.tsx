import { Edit, PlusCircleIcon, Trash, X } from "lucide-react";
import { Button } from "../components/ui/button";
import Container from "../components/ui/container";
import FormContainer from "../components/ui/form-container";
import FormGrid from "../components/ui/form-grid";
import Header from "../components/ui/header";
import { Input } from "../components/ui/input";
import Label from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import ModalContainer from "../components/ui/modal-container";

export const FichaCliente = () => {
  return (
    <ModalContainer>
      <Header
        action={
          <Button variant="table" className="bg-red rounded-full">
            <X strokeWidth={4} />
          </Button>
        }
      >
        Ficha Cliente
      </Header>
      <FormContainer className="border-none">
        <FormGrid>
          <div>
            <Label>Nro Telefono</Label>
            <Input />
          </div>
          <div className="flex justify-end self-end gap-3">
            <Button>
              <PlusCircleIcon />
              Nuevo
            </Button>
            <Button>
              <Edit />
              Modificar
            </Button>
            <Button>
              <Trash />
              Eliminar
            </Button>
          </div>
        </FormGrid>
      </FormContainer>
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Nombre*</Label>
            <Input />
          </div>
          <div>
            <Label>Apellido*</Label>
            <Input />
          </div>
          <div>
            <Label>Nickname*</Label>
            <Input />
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Teléfono*</Label>
            <Input />
          </div>
          <div>
            <Label>Tipo de Cliente*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Dirección*</Label>
            <Input />
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Provincia*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ciudad*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Distrito*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
                <SelectItem value="Value">Value</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Referencia</Label>
            <Textarea />
          </div>
        </FormGrid>
      </FormContainer>
      <div className="grid grid-cols-4 gap-15 w-full">
        <Button variant="outline" className="col-span-1">
          Cancelar
        </Button>
        <Button className="col-span-3">Siguiente</Button>
      </div>
    </ModalContainer>
  );
};
