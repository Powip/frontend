"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

import Container from "../ui/container";
import Header from "../ui/header";
import FormGrid from "../ui/form-grid";
import FormContainer from "../ui/form-container";
import Label from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import { getPedidos } from "@/services/orderService";
import { IOrder } from "@/interfaces/IOrder";

import PedidosTable from "./PedidosTable";

const ListadoPedidos = () => {
  const [pedidos, setPedidos] = useState<IOrder[]>([]);
  const [rangeVenta, setRangeVenta] = useState<
    { from: Date; to: Date } | undefined
  >();
  const [rangeEntrega, setRangeEntrega] = useState<
    { from: Date; to: Date } | undefined
  >();

  useEffect(() => {
    getPedidos().then((data) => setPedidos(data));
  }, []);

  return (
    <Container>
      <Header className="mb-6">Pedidos</Header>
      <FormContainer>
        <FormGrid>
          {/* Nro Teléfono */}
          <div>
            <Label>Nro Teléfono</Label>
            <Input name="nroTelefono" placeholder="Nro Teléfono" />
          </div>
          {/* Cliente */}
          <div>
            <Label>Cliente</Label>
            <Input name="client" placeholder="Cliente" />
          </div>
          {/* Status */}
          <div>
            <Label>Status</Label>
            <div className="flex items-center gap-2">
              <Select name="status">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="preparado">Preparado</SelectItem>
                  <SelectItem value="pendStock">Pendiente Stock</SelectItem>
                  <SelectItem value="sinStock">Sin Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Entrega */}
          <div>
            <Label>Entrega</Label>
            <div className="flex items-center gap-2">
              <Select name="entrega">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lima">Lima</SelectItem>
                  <SelectItem value="puntoScharf">Punto Scharf</SelectItem>
                  <SelectItem value="recojoTienda">Recojo en Tienda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Canal de Venta */}
          <div>
            <Label>Canal de Venta</Label>
            <div className="flex items-center gap-2">
              <Select name="canalVenta">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="falabella">Falabella</SelectItem>
                  <SelectItem value="tiendaOp">Tienda OP</SelectItem>
                  <SelectItem value="ventaMayorista">VentaMayorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Estado de Pago */}
          <div>
            <Label>Estado de Pago</Label>
            <div className="flex items-center gap-2">
              <Select name="estadoPago">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="porRecaudar">Por Recaudar</SelectItem>
                  <SelectItem value="recaudado">Recaudado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormGrid>

        <FormGrid>
          {/* Fecha Venta */}
          <div>
            <Label>Fecha Venta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="table"
                  className="w-full px-3 py-2 border border-input rounded-md text-left bg-background text-gray-700 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {rangeVenta?.from
                    ? rangeVenta.from.toLocaleDateString()
                    : "Desde"}{" "}
                  -{" "}
                  {rangeVenta?.to
                    ? rangeVenta.to.toLocaleDateString()
                    : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={rangeVenta}
                  onSelect={(range) => {
                    if (range?.from && range?.to)
                      setRangeVenta({ from: range.from, to: range.to });
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Fecha Entrega */}
          <div>
            <Label>Fecha Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="table"
                  className="w-full px-3 py-2 border border-input rounded-md text-left bg-background text-gray-700 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {rangeEntrega?.from
                    ? rangeEntrega.from.toLocaleDateString()
                    : "Desde"}{" "}
                  -{" "}
                  {rangeEntrega?.to
                    ? rangeEntrega.to.toLocaleDateString()
                    : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={rangeEntrega}
                  onSelect={(range) => {
                    if (range?.from && range?.to)
                      setRangeEntrega({ from: range.from, to: range.to });
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Vendedor */}
          <div>
            <Label>Vendedor</Label>
            <Select name="vendedor">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heidyMedina">Heidy Medina</SelectItem>
                <SelectItem value="marceGuerrero">Marcela Guerrero</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Courier */}
          <div>
            <Label>Courier</Label>
            <Select name="courier">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sinCourier">Sin Courier</SelectItem>
                <SelectItem value="marvisur">Marvisur</SelectItem>
                <SelectItem value="rappi">Rappi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div className="flex gap-3 justify-end px-8">
            <Button variant="default" asChild>
              <Link href="/">Filtrar</Link>
            </Button>
          </div>
          <div className="flex ">
            <Button variant="default" asChild>
              <Link href="/">Generar Ticket</Link>
            </Button>
          </div>
        </FormGrid>
      </FormContainer>

      <div className="px-6">
        <PedidosTable pedidos={pedidos} />
      </div>
    </Container>
  );
};

export default ListadoPedidos;
