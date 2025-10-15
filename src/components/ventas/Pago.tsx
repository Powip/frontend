import React from "react";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";
import { Input } from "../ui/input";
import Header from "../ui/header";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { SelectValue } from "@radix-ui/react-select";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import Container from "../ui/container";

type Props = {
  prev: () => void;
};

export const Pago = ({ prev }: Props) => {
  return (
    <Container>
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
          onClick={prev}
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>
        <Button
          onClick={() => alert("Enviado")}
          variant="lime"
          className="col-span-3"
        >
          Enviar
        </Button>
      </div>
    </Container>
  );
};
