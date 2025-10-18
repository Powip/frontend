"use client";

import React, { useState } from "react";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";
import { Input } from "../ui/input";
import Header from "../ui/header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import Container from "../ui/container";

type Props = {
  prev: () => void;
  onSubmit: (data: {
    metodoPago: string;
    envio: string;
    adelanto: string;
    observaciones: string;
  }) => void;
};

export const Pago = ({ prev, onSubmit }: Props) => {
  const [metodoPago, setMetodoPago] = useState("");
  const [envio, setEnvio] = useState("");
  const [adelanto, setAdelanto] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const handleSubmit = () => {
    if (!metodoPago || !envio || !adelanto) {
      alert("Por favor, complete todos los campos obligatorios (*)");
      return;
    }

    onSubmit({ metodoPago, envio, adelanto, observaciones });
  };

  return (
    <Container>
      <Header>Pago</Header>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Metodo de Pago*</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Envío*</Label>
            <Input value={envio} onChange={(e) => setEnvio(e.target.value)} />
          </div>

          <div>
            <Label>Adelanto*</Label>
            <Input
              type="number"
              value={adelanto}
              onChange={(e) => setAdelanto(e.target.value)}
            />
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </FormGrid>
      </FormContainer>

      <div className="grid grid-cols-4 gap-[15px] w-full mt-4">
        <Button
          onClick={prev}
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>

        <Button onClick={handleSubmit} variant="lime" className="col-span-3">
          Enviar
        </Button>
      </div>
    </Container>
  );
};
