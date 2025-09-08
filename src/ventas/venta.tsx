import { Button } from "../components/ui/button";
import FormContainer from "../components/ui/form-container";
import FormGrid from "../components/ui/form-grid";
import Header from "../components/ui/header";
import { Input } from "../components/ui/input";
import Label from "../components/ui/label";
import ModalContainer from "../components/ui/modal-container";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

export const Venta = () => {
  return (
    <ModalContainer>
        <Header>Venta</Header>
      <FormContainer className="border-none px-8 py-0">
        <FormGrid>
        <div className="flex justify-end">
          <Button>Seleccionar archivo</Button>
        </div>
        </FormGrid>
      </FormContainer>
      <FormContainer>
        <FormGrid>
        <div>
          <Label>Gestion*</Label>
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
          <Label>Canal*</Label>
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
          <Label>Canal de Cierre*</Label>
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
          <Label>Tienda*</Label>
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
          <Label>Entrega en:*</Label>
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
          <Label>Enviar por:*</Label>
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
            <Label>DNI*</Label>
            <Input />
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
              <Button variant="outline" className="col-span-1 border-sky-blue text-sky-blue">
                Regresar
              </Button>
              <Button className="col-span-3">Siguiente</Button>
            </div>
    </ModalContainer>
  );
};
