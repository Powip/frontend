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
import { useCreateOrderWithItems } from "@/src/hooks/useVentas";
import { IAddItem, ICreateOrderHeaderPlusItems, IOrderItem } from "@/src/api/Interfaces";
import { toast } from "sonner";

type Props = {
  next: () => void;
  prev: () => void;
  orderId: string;
  cartItems: IAddItem[];
  onAddItem: (...args: any[]) => void;
  onUpdateTotals: (t: {
    totalAmount: number;
    totalVat: number;
    totalShippingCost: number;
  }) => void;
  onOrderUpdated: (id: string) => void;
};

export const Productos = ({
  next,
  orderId,
  cartItems,
  onAddItem,
  onUpdateTotals,
  onOrderUpdated,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { products } = useCatalogoProductos();
  const { mutateAsync: createOrderWithItems, isPending } =
    useCreateOrderWithItems();

  // Eliminar producto del carrito
  const handleDelete = (id: string) => {
    const updated = cartItems.filter((item) => item.productId !== id);
    const totalAmount = updated.reduce(
      (acc, item) => acc + Number(item.unitPrice) * item.quantity,
      0
    );
    onUpdateTotals({
      totalAmount,
      totalVat: totalAmount * 0.18,
      totalShippingCost: 0,
    });
  };

  // Crear orden + items
  const handleNextFromProductos = async () => {
    if (!orderId) {
      toast.error("No hay una orden creada. Vuelve al paso Venta.");
      return;
    }
    if (!cartItems || cartItems.length === 0) {
      toast.error("Agrega al menos un producto al carrito antes de continuar.");
      return;
    }

    const stored = localStorage.getItem("currentOrder");
    if (!stored) {
      toast.error("No se encontró la orden local.");
      return;
    }

    let header;
    try {
      header = JSON.parse(stored);
    } catch {
      toast.error("Orden local inválida.");
      return;
    }

    // Armar items
    const items = cartItems.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice ?? Number(it.priceBase ?? 0)),
      discountType: it.discountType?.toUpperCase() ?? "PORCENTAJE",
      discountAmount: Number(it.discountAmount ?? it.discountValue ?? 0),
      attributes: Array.isArray(it.attributes)
        ? it.attributes.map((attr) => ({
            name: attr.name,
            value: attr.value,
          }))
        : [],
      observations: it.observations ?? "",
      status: true,
    }));

    const totalAmount = items.reduce(
      (acc, it) => acc + (it.unitPrice ?? 0) * (it.quantity ?? 0),
      0
    );
    const totalVat = parseFloat((totalAmount * 0.18).toFixed(2)); // iva
    const totalShippingCost = header.totalShippingCost ?? 0;

    const payload: ICreateOrderHeaderPlusItems = {
      receiptType: "FACT",
      managementType: header.managementType,
      companyId: "5d5b824c-2b81-4b17-960f-855bfc7806e2",
      store: header.store,
      storeAssigned: header.storeAssigned,
      deliveryPoint: header.deliveryPoint,
      salesChannel: header.salesChannel,
      closingChannel: header.closingChannel,
      gestion: "Gestion Octubre",
      courier: header.courier,
      reference: header.reference ?? "Sin referencia",
      totalAmount,
      totalVat,
      totalShippingCost,
      customerId: header.customerId,
      status: "PENDIENTE",
      // @ts-expect-error: Errores temporales
      items,
    };

    console.log("✅ Payload final enviado al backend:", payload);

    try {
      const response = await createOrderWithItems(payload);
      const serverId =
        response?.id ?? response?.orderId ?? response?.data?.id ?? null;

      if (serverId) {
        localStorage.setItem(
          "currentOrder",
          JSON.stringify({ ...payload, id: serverId })
        );
        onOrderUpdated(serverId);
        toast.success("Orden creada en servidor");
      } else {
        toast.warning("Orden creada sin ID explícito");
      }

      onUpdateTotals({ totalAmount, totalVat, totalShippingCost });
      next();
    } catch (err) {
      console.error("Error al crear la orden:", err);
      toast.error("Error al crear la orden en el servidor.");
    }
  };

  return (
    <Container>
      <Header>Productos</Header>

      {/* Filtro */}
      <FormContainer className="border-none py-0">
        <FormGrid>
          <div className="grid grid-cols-4 gap-15 w-full">
            <div className="col-span-3">
              <Label>Producto</Label>
              <Input
                icon={Search}
                iconPosition="right"
                placeholder="Buscar producto..."
              />
            </div>
            <Button
              className="col-span-1 self-end"
              onClick={() => setIsOpen(true)}
              disabled={isPending}
            >
              Agregar Producto
            </Button>
          </div>
        </FormGrid>
      </FormContainer>

      {/* Tabla de carrito */}
      <div className="px-8">
        <h2 className="font-medium mb-2">Carrito de compras:</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio Unitario</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cartItems.length > 0 ? (
              cartItems.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>

                  <TableCell>S/ {Number(item.unitPrice).toFixed(2)}</TableCell>
                  <TableCell>
                    S/ {(Number(item.unitPrice) * item.quantity).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {item.discountType
                      ? `${item.discountValue}${
                          item.discountType === "PORCENTAJE" ? "%" : ""
                        }`
                      : "-"}
                  </TableCell>
                  <TableActions>
                    <Button
                      variant="table"
                      size="icon"
                      className="bg-red"
                      onClick={() => handleDelete(item.productId)}
                      disabled={isPending}
                    >
                      <Trash />
                    </Button>
                  </TableActions>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-4 text-gray-500"
                >
                  No hay productos en el carrito
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="w-full">
        <Button
          onClick={handleNextFromProductos}
          className="w-full"
          disabled={isPending}
        >
          {isPending ? "Cargando Productos..." : "Cargar Productos y Continuar"}
        </Button>
      </div>

      {isOpen && (
        <AgregarProducto
          products={products}
          onAdd={(item) => {
            onAddItem(item);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </Container>
  );
};
