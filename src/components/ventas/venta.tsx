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
import { useCreateOrderHeader } from "@/src/hooks/useVentas";
import { toast } from "sonner";
import { ICreateOrderHeader, IOrder } from "@/src/api/Interfaces";

type Props = {
  next: (order: IOrder) => void; // 🔹 ahora recibe la orden creada
  prev: () => void;
  customerId: string; // 🔹 viene del paso anterior en SaleFlow
};

export const Venta = ({ next, prev, customerId }: Props) => {
  // =============================
  // Estados locales del formulario
  // =============================
  const [gestion, setGestion] = useState("");
  const [canal, setCanal] = useState("");
  const [canalCierre, setCanalCierre] = useState("");
  const [tienda, setTienda] = useState("");
  const [entregaEn, setEntregaEn] = useState("");
  const [enviarPor, setEnviarPor] = useState("");
  const [dni, setDni] = useState("");
  const [referencia, setReferencia] = useState("");

  // =============================
  // Mutación (crear orden)
  // =============================
  const createOrder = useCreateOrderHeader();

  const handleSubmit = () => {
    if (!dni || !gestion || !canal || !canalCierre || !tienda) {
      toast.error("Por favor completa todos los campos obligatorios (*)");
      return;
    }

    if (!customerId) {
      toast.error("Debes seleccionar un cliente antes de crear la orden");
      return;
    }

    const payload = {
    receiptType: "FACT",                // ≤10 caracteres
    managementType: gestion,            // ≤20 caracteres
    deliveryPoint: entregaEn,           // ≤30 caracteres
    salesChannel: canal,                // UUID
    closingChannel: canalCierre,        // UUID
    storeAssigned: tienda,              // UUID
    gestion,                             // ≤50 caracteres
    store: tienda,                       // ≤50 caracteres
    courier: enviarPor,                  // ≤50 caracteres
    totalAmount: 1,                      // número positivo (se actualizará con productos)
    totalVat: 1,                         // número
    totalShippingCost: 1,                // número
    customerId,                          // UUID del cliente
    status: "PENDIENTE",
    reference: referencia || "",
  };

     console.log("Payload enviado a createOrderHeader:", payload);


     createOrder.mutate(payload, {
    onSuccess: (data: IOrder) => {
      toast.success("Orden creada con éxito");
      console.log("Orden creada:", data);
      next(data); // 🔹 pasa la orden al flujo principal
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || "Error al crear la orden");
    },
  });
  };

  // =============================
  // Render
  // =============================
  return (
    <Container>
      <Header>Venta</Header>

      {/* Archivo */}
      <FormContainer className="border-none px-8 py-0">
        <FormGrid>
          <div className="flex justify-end">
            <Button>Seleccionar archivo</Button>
          </div>
        </FormGrid>
      </FormContainer>

      {/* Formulario */}
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
                <SelectItem value="tienda-op">Tienda OP</SelectItem>
                <SelectItem value="web-kunka">Web Kunka</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Canal de Cierre*</Label>
            <Select onValueChange={setCanalCierre}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Canal de cierre de la venta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="668cbc82-08aa-4a09-9dd1-6a5fc132c3a7">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
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
                <SelectItem value="tienda-shopping">Tienda Shopping</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Entrega en:*</Label>
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
            <Label>Enviar por:*</Label>
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
            <Label>DNI*</Label>
            <Input value={dni} onChange={(e) => setDni(e.target.value)} />
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Referencia</Label>
            <Textarea
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
        </FormGrid>
      </FormContainer>

      {/* Botones */}
      <div className="grid grid-cols-4 gap-15 w-full mt-6">
        <Button
          onClick={prev}
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>

        <Button
          onClick={handleSubmit}
          className="col-span-3"
          disabled={createOrder.isPending}
        >
          {createOrder.isPending ? "Creando..." : "Siguiente"}
        </Button>
      </div>
    </Container>
  );
};
