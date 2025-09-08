import React from "react";
import ModalContainer from "../components/ui/modal-container";
import FormContainer from "../components/ui/form-container";
import FormGrid from "../components/ui/form-grid";
import Label from "../components/ui/label";
import { Input } from "../components/ui/input";
import Header from "../components/ui/header";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../components/ui/select";
import { SelectValue } from "@radix-ui/react-select";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";

export const PagoComponent = () => {
  return (
    <ModalContainer>
      <Header>Pago</Header>
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Metodo de Pago*</Label>
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
            <Label>Envío*</Label>
            <Input />
          </div>
          <div>
            <Label>Adelanto*</Label>
            <Input />
          </div>
        </FormGrid>
        <FormGrid>
            <div>
            <Label>Observaciones</Label>
            <Textarea />
          </div>
        </FormGrid>
      </FormContainer>
      <div className="grid grid-cols-4 gap-15 w-full">
        <Button
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>
        <Button variant='lime' className="col-span-3">Enviar</Button>
      </div>
    </ModalContainer>
  );
};
