import { Edit, PlusCircleIcon, Trash} from "lucide-react";
import { Button } from "../ui/button";
import Container from "../ui/container";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Header from "../ui/header";
import { Input } from "../ui/input";
import Label from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

type Props = {
  next: () => void;
};

export const FichaCliente = ({ next }: Props) => {
  return (
    <Container>
      <Header>Cliente</Header>
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
      <div>
        <Button className="w-full" onClick={next}>
          Siguiente
        </Button>
      </div>
    </Container>
  );
};
