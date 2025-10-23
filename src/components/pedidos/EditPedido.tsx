"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

import { toast } from "sonner";

import Header from "../ui/header";
import Container from "../ui/container";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { IOrder } from "@/interfaces/IOrder";
import { getPedidoById } from "@/services/orderService";
import ProductPedidoTable from "./productPedidoTable";

const EditPedido = () => {
  const params = useParams();
  const id = params?.id as string;

  //Proveedor que traemos de la BD

  const [pedido, setPedido] = useState<IOrder>({
    id: "",
    dateVta: "",
    dateEntrega: "",
    status: "",
    tag: "",
    estadoPago: "",
    telefono: "",
    cliente: "",
    vendedor: "",
    courier: "",
    direccion: "",
    distrito: "",
    provincia: "",
    entrega: "",
    datosEntrega: "",
    contactoAdicional: "",
    telefonoAdicional: "",
    canalVenta: "",
    impTotal: 0,
    impPendiente: 0,
    claveRecojo: "",
    trakking: "",
    agente: "",
  });

  //Trayendo los datos del pedido
  useEffect(() => {
    const fetchPedido = async () => {
      try {
        const data = await getPedidoById(id);
        setPedido(data);
      } catch (error) {
        console.error("Error al traer pedido", error);
        toast.error("Error al cargar los datos del pedido");
      }
    };
    if (id) fetchPedido();
  }, [id]);

  //Handle change
  const handleChange = (key: string, value: string) => {
    setPedido((prev) => ({
      ...prev,
      [key]:
        key === "impTotal" || key === "impPendiente"
          ? parseFloat(value) || 0
          : value,
    }));
  };

  return (
    <Container>
      <form>
        <Header>
          Pedido - {pedido.cliente} - {pedido.dateVta}
        </Header>

        {/* Datos Clientes */}
        <FormContainer>
          <h2 className="text-xl font-bold">Datos Cliente</h2>
          <FormGrid>
            {/* Telefono */}
            <div>
              <Label>Teléfono</Label>
              <Input
                name="telefono"
                value={pedido.telefono}
                onChange={(e) => handleChange("telefono", e.target.value)}
                placeholder="Telefono"
              />
            </div>

            {/* Dirección */}
            <div>
              <Label>Dirección</Label>
              <Input
                name="direccion"
                value={pedido.direccion}
                onChange={(e) => handleChange("direccion", e.target.value)}
                placeholder="Dirección"
              />
            </div>

            {/* Distrito */}
            <div>
              <Label>Distrito</Label>
              <Input
                name="distrito"
                value={pedido.distrito}
                onChange={(e) => handleChange("distrito", e.target.value)}
                placeholder="Distrito"
              />
            </div>

            {/* Provincia */}
            <div>
              <Label>Provincia</Label>
              <Input
                name="provincia"
                value={pedido.provincia}
                onChange={(e) => handleChange("provincia", e.target.value)}
                placeholder="Provincia"
              />
            </div>
          </FormGrid>
          <FormGrid>
            {/* Entrega */}
            <div>
              <Label>Entrega</Label>
              <Input
                name="entrega"
                value={pedido.entrega}
                onChange={(e) => handleChange("entrega", e.target.value)}
                placeholder="Entrega"
              />
            </div>

            {/* Datos de Entrega */}
            <div>
              <Label>Datos de Entrega</Label>
              <Input
                name="datosEntrega"
                value={pedido.datosEntrega}
                onChange={(e) => handleChange("datosEntrega", e.target.value)}
                placeholder="Datos Entrega"
              />
            </div>

            {/* Contacto Adicional */}
            <div>
              <Label>Contacto Adicional</Label>
              <Input
                name="contactoAdicional"
                value={pedido.contactoAdicional}
                onChange={(e) =>
                  handleChange("contactoAdicional", e.target.value)
                }
                placeholder="Contacto Adicional"
              />
            </div>

            {/* Teléfono Adicional */}
            <div>
              <Label>Telefono Adicional</Label>
              <Input
                name="telefonoAdicional"
                value={pedido.telefonoAdicional}
                onChange={(e) =>
                  handleChange("telefonoAdicional", e.target.value)
                }
                placeholder="telefono Adicional"
              />
            </div>
          </FormGrid>
        </FormContainer>

        {/* Datos Ventas */}
        <FormContainer>
          <h2 className="text-xl font-bold">Datos Ventas</h2>
          <FormGrid>
            {/* Canal de Venta */}
            <div>
              <Label>Canal de Venta</Label>
              <Input
                name="canalVenta"
                value={pedido.canalVenta}
                onChange={(e) => handleChange("canalVenta", e.target.value)}
                placeholder="Canal Venta"
              />
            </div>

            {/* Estado Pago */}
            <div>
              <Label>Estado Pago</Label>
              <Input
                name="estadoPago"
                value={pedido.estadoPago}
                onChange={(e) => handleChange("estadoPago", e.target.value)}
                placeholder="Estado Pago"
              />
            </div>

            {/* Importe Total*/}
            <div>
              <Label>Importe Total</Label>
              <Input
                name="impTotal"
                value={String(pedido.impTotal ?? 0)}
                onChange={(e) => handleChange("impTotal", e.target.value)}
                placeholder="Importe Total"
              />
            </div>

            {/* Pendiente por Pagar*/}
            <div>
              <Label>Pendiente por Pagar</Label>
              <Input
                name="impPendiente"
                value={String(pedido.impPendiente ?? 0)}
                onChange={(e) => handleChange("impPendiente", e.target.value)}
                placeholder="Importe Pendiente"
              />
            </div>
          </FormGrid>
          <FormGrid>
            <div className="flex gap-3 justify-center px-8">
              <Button variant="default">Registrar Pago</Button>
              <Button variant="default">Ver Comprobante Pago</Button>
            </div>
          </FormGrid>
        </FormContainer>

        {/* Datos Entrega */}
        <FormContainer>
          <h2 className="text-xl font-bold">Datos Entrega</h2>
          <FormGrid>
            {/* Fecha de Entrega */}
            <div>
              <Label>Fecha de Entrega</Label>
              <Input
                name="dateEntrega"
                value={pedido.dateEntrega}
                onChange={(e) => handleChange("dateEntrega", e.target.value)}
                placeholder="Fecha Entrega"
              />
            </div>

            {/* Empresa Curier */}
            <div>
              <Label>Empresa Curier</Label>
              <Input
                name="courier"
                value={pedido.courier}
                onChange={(e) => handleChange("courier", e.target.value)}
                placeholder="Empresa Courier"
              />
            </div>

            {/* Clave de Recojo */}
            <div>
              <Label>Clave de Recojo</Label>
              <Input
                name="claveRecojo"
                value={pedido.claveRecojo}
                onChange={(e) => handleChange("claveRecojo", e.target.value)}
                placeholder="Clave de Recojo"
              />
            </div>

            {/* Trakking */}
            <div>
              <Label>Trakking</Label>
              <Input
                name="trakking"
                value={pedido.trakking}
                onChange={(e) => handleChange("trakking", e.target.value)}
                placeholder="Trakking"
              />
            </div>
          </FormGrid>
          <FormGrid>
            <div className="flex gap-3 justify-center px-8">
              <Button variant="default">Courier</Button>
              <Button variant="default">Ver Comprobante Pago</Button>
            </div>
          </FormGrid>
        </FormContainer>

        {/* Pedido */}
        <FormContainer>
          <h2 className="text-xl font-bold">Datos Pedido</h2>
          <FormGrid>
            {/* Status */}
            <div>
              <Label>Status</Label>
              <Input
                name="status"
                value={pedido.status}
                onChange={(e) => handleChange("status", e.target.value)}
                placeholder="status"
              />
            </div>

            {/* Agente */}
            <div>
              <Label>Agente</Label>
              <Input
                name="agente"
                value={pedido.agente}
                onChange={(e) => handleChange("agente", e.target.value)}
                placeholder="agente"
              />
            </div>

            {/* Botón historial */}
            <div className="flex items-end">
              <Button variant="default" className="w-full">
                Ver Historial
              </Button>
            </div>
          </FormGrid>
        </FormContainer>
      </form>

      {/* Tabla Productos */}
      <div className="px-6">
        <ProductPedidoTable />
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-10 mb-4">
        <Button variant="default">Guardar</Button>
        <Button variant="default">Imprimir Ticket</Button>
        <Button variant="default">Generar Factura</Button>
      </div>
    </Container>
  );
};

export default EditPedido;
