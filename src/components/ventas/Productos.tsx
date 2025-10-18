"use client";

import { Search, Trash } from "lucide-react";
import { useState } from "react";
import FormGrid from "../ui/form-grid";
import Header from "../ui/header";
import { Input } from "../ui/input";
import Label from "../ui/label";
import { Button } from "../ui/button";
import FormContainer from "../ui/form-container";
import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { AgregarProducto } from "./AgregarProducto";
import Container from "../ui/container";
import { useCatalogoProductos } from "@/src/hooks/useCatalogoProductos";
import { IOrderItem, ICreateOrderItemsDto } from "@/src/api/Interfaces";
import { useCreateOrderWithItems } from "@/src/hooks/useVentas";
import { toast } from "sonner";

type Props = {
  next: () => void;
  prev: () => void;
  orderId: string;
  cartItems: IOrderItem[];
  onAddItem: (item: IOrderItem) => void;
};

export const Productos = ({ next, prev, orderId, cartItems, onAddItem }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { products } = useCatalogoProductos();
  const createOrderWithItems = useCreateOrderWithItems();

  // 🔹 Ahora sólo agrega localmente
  const handleAddItem = (item: IOrderItem) => {
    onAddItem(item);
    toast.success("Producto agregado al carrito");
    setIsOpen(false);
  };

  // 🔹 El POST se hace solo acá
  const handleNext = async () => {
    const raw = localStorage.getItem("currentOrder");
    if (!raw) {
      toast.error("No hay orden local guardada");
      return;
    }

    let localOrder;
    try {
      localOrder = JSON.parse(raw);
    } catch (e) {
      console.error("Error parsing localOrder:", e);
      toast.error("Orden local inválida");
      return;
    }

    if (!cartItems || cartItems.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    // 🔹 Transformar ítems del carrito a formato backend
    const itemsPayload: ICreateOrderItemsDto[] = cartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountType: (item.discountType || "").toUpperCase(),
      discountAmount: item.discountValue ?? 0,
      attributes: item.attributes || [],
      observations: item.observations || "",
      status: true,
    }));

    // 🔹 Unir encabezado con los ítems
    const payload = {
      ...localOrder,
      items: itemsPayload,
    };

    try {
      await createOrderWithItems.mutateAsync(payload);
      toast.success("Orden enviada al servidor");
      next();
    } catch (error) {
      console.error("Error creando orden con ítems:", error);
      toast.error("Error al crear la orden en el servidor");
    }
  };

  return (
    <Container>
      <Header>Productos</Header>

      <FormContainer className="border-none py-0">
        <FormGrid>
          <div className="grid grid-cols-4 gap-15 w-full">
            <div className="col-span-3">
              <Label>Producto</Label>
              <Input icon={Search} iconPosition="right" />
            </div>
            <Button className="col-span-1 self-end" onClick={() => setIsOpen(true)}>
              Agregar Producto
            </Button>
          </div>
        </FormGrid>
      </FormContainer>

      <div>
        <h2 className="font-medium px-8">Carrito de compras:</h2>
      </div>

      <div className="px-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cartItems.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-gray-50">
                <TableCell>{item.productName}</TableCell>
                <TableCell>
                  {item.attributes?.find((a) => a.name === "Talla")?.value || "-"}
                </TableCell>
                <TableCell>
                  {item.attributes?.find((a) => a.name === "Color")?.value || "-"}
                </TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>
                  {item.discountType === "PORCENTAJE"
                    ? `${item.discountValue}%`
                    : item.discountValue}
                </TableCell>
                <TableActions>
                  <Button variant="table" size="icon" className="bg-red">
                    <Trash />
                  </Button>
                </TableActions>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-4 gap-15 w-full">
        <Button
          onClick={prev}
          variant="outline"
          className="col-span-1 border-sky-blue text-sky-blue"
        >
          Regresar
        </Button>

        <Button onClick={handleNext} className="col-span-3">
          Siguiente
        </Button>
      </div>

      {isOpen && (
        <AgregarProducto
          products={products}
          onClose={() => setIsOpen(false)}
          onAdd={handleAddItem}
        />
      )}
    </Container>
  );
};
