"use client";

import React, { useState } from "react";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";

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
import { toast } from "sonner";
import { ICreatePaymentDto } from "@/api/Interfaces";
import { useCreatePaymentForOrder } from "@/hooks/useVentas";
import { Label } from "../ui/label";

interface Totals {
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
}

type Props = {
  prev: () => void;
  orderId: string;
  totals: Totals;
  onPaymentCompleted: () => void;
};

// Mapeo de métodos de pago locales a valores esperados por el backend
const mapPaymentMethod = (localMethod: string): string => {
  switch (localMethod) {
    case "efectivo":
      return "CASH";
    case "tarjeta":
      return "CREDIT_CARD";
    case "transferencia":
      return "BANK_TRANSFER";
    default:
      return "OTHER";
  }
};

export const Pago = ({ orderId, totals, onPaymentCompleted }: Props) => {
  const [metodoPago, setMetodoPago] = useState("");
  const [envio, setEnvio] = useState("");
  const [adelanto, setAdelanto] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const createPaymentMutation = useCreatePaymentForOrder();

  const handleSubmit = () => {
    if (!metodoPago || !adelanto || !orderId) {
      toast.error("Por favor, complete el Método de Pago y el Adelanto.");
      return;
    }

    const paymentAmount = parseFloat(adelanto);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error("El Adelanto debe ser un número positivo.");
      return;
    }
    // @ts-expect-error: Errores temporales
    const payload: ICreatePaymentDto = {
      orderId,
      paymentMethod: mapPaymentMethod(metodoPago),
      amount: paymentAmount,
      paymentDate: new Date().toISOString(),
      generalNote: `Envío: ${envio}. Observaciones: ${observaciones}`,
    };

    console.log("Payload de pago:", payload);

    createPaymentMutation.mutate(
      { orderId, payload },
      {
        onSuccess: () => {
          toast.success("Pago registrado con éxito");
          onPaymentCompleted();
        },
        onError: (error) => {
          console.error("Error al crear el pago:", error);
          toast.error("Error al registrar el pago. Intente de nuevo.");
        },
      }
    );
  };

  return (
    <Container>
      <Header>Pago</Header>

      <div className="mb-4 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold text-lg text-green-700">
          Resumen de la Orden
        </h3>
        <p>Total a Pagar: ${totals.totalAmount.toFixed(2)}</p>
        <p>IVA: ${totals.totalVat.toFixed(2)}</p>
      </div>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Método de Pago*</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">
                  Tarjeta (Crédito/Débito)
                </SelectItem>
                <SelectItem value="transferencia">
                  Transferencia Bancaria
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Envío</Label>
            <Input value={envio} onChange={(e) => setEnvio(e.target.value)} />
          </div>

          <div>
            <Label>Monto del Pago (Adelanto)*</Label>
            <Input
              type="number"
              value={adelanto}
              onChange={(e) => setAdelanto(e.target.value)}
              placeholder={`Monto a pagar (Max: ${totals.totalAmount.toFixed(
                2
              )})`}
              max={totals.totalAmount.toFixed(2)}
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

      <div className="w-full ">
        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={createPaymentMutation.isPending}
        >
          {createPaymentMutation.isPending ? "Procesando..." : "Registrar Pago"}
        </Button>
      </div>
    </Container>
  );
};
