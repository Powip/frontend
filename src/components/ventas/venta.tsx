"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { ICreateOrderHeader } from "@/src/api/Interfaces";

type Props = {
  next: (order: ICreateOrderHeader) => void;
  prev: () => void;
  customerId: string;
};

export const Venta = ({ next, customerId }: Props) => {
  const [gestion, setGestion] = useState("");
  const [canal, setCanal] = useState("");
  const [canalCierre, setCanalCierre] = useState("");
  const [tienda, setTienda] = useState("");
  const [entregaEn, setEntregaEn] = useState("");
  const [enviarPor, setEnviarPor] = useState("");
  const [dni, setDni] = useState("");
  const [referencia, setReferencia] = useState("");

  const handleSubmit = () => {
    if (!dni || !gestion || !canal || !canalCierre || !tienda) {
      toast.error("Por favor completa todos los campos obligatorios (*)");
      return;
    }
    if (!customerId) {
      toast.error("Debes seleccionar un cliente antes de crear la orden");
      return;
    }

    // Creamos orden local
    const localOrder: ICreateOrderHeader = {
      id: `local-${Date.now()}`,
      receiptType: "FACT",
      managementType: gestion,
      deliveryPoint: entregaEn,
      salesChannel: canal,
      closingChannel: canalCierre,
      storeAssigned: tienda,
      store: tienda,
      courier: enviarPor,
      totalAmount: 0,
      totalVat: 0,
      totalShippingCost: 0,
      customerId,
      status: "PENDIENTE",
      reference: referencia || "",
      items: [],
    };

    localStorage.setItem("currentOrder", JSON.stringify(localOrder));
    toast.success("Orden creada");
    next(localOrder);
  };

  return (
    <Container>
      <Header>Venta</Header>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Gestión*</Label>
            <Select onValueChange={setGestion}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venta">Venta</SelectItem>
                <SelectItem value="canje">Canje</SelectItem>
                <SelectItem value="reserva">Reserva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Canal*</Label>
            <Select onValueChange={setCanal}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="668cbc82-08aa-4a09-9dd1-6a5fc132c3a7">Falabella</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Canal de Cierre*</Label>
            <Select onValueChange={setCanalCierre}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar canal de cierre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="668cbc82-08aa-4a09-9dd1-6a5fc132c3a7">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Tienda*</Label>
            <Select onValueChange={setTienda}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7e9d979c-44c6-4fea-843c-15b4ef8a5b71">Tienda Central</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Entrega en*</Label>
            <Select onValueChange={setEntregaEn}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recoje-en-tienda">Recoje en tienda</SelectItem>
                <SelectItem value="lima">Lima</SelectItem>
                <SelectItem value="provincia">Provincia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Enviar por*</Label>
            <Select onValueChange={setEnviarPor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motorista">Motorista</SelectItem>
                <SelectItem value="tradicional">Tradicional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>DNI</Label>
            <Input value={dni} onChange={(e) => setDni(e.target.value)} />
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Referencia</Label>
            <Textarea value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
        </FormGrid>
      </FormContainer>

      <div className="w-full mt-6">
        <Button onClick={handleSubmit} className="w-full">
          Generar Venta
        </Button>
      </div>
    </Container>
  );
};
