"use client";

import { toast } from "sonner";
import React, { useState } from "react";
import ModalContainer from "../ui/modal-container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { IOrderItem } from "@/src/api/Interfaces";
import { IProduct } from "../products/interfaces";

type Props = {
  onClose: () => void;
  onAdd: (item: IOrderItem) => void;
  products: IProduct[];
};

export const AgregarProducto = ({ onClose, onAdd, products }: Props) => {
  const FIXED_SIZES = ["S", "M", "L", "XL", "XXL"];
  const FIXED_COLORS = ["Rojo", "Azul", "Negro", "Blanco", "Gris"];

  const [selectedProduct, setSelectedProduct] = useState<IProduct | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [discountType, setDiscountType] = useState<string>("");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [color, setColor] = useState<string>(FIXED_COLORS[0]);
  const [size, setSize] = useState<string>(FIXED_SIZES[0]);

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId) || null;
    setSelectedProduct(product);
    setQuantity(1);
    setDiscountType("");
    setDiscountValue(0);
    setSize(FIXED_SIZES[0]);
    setColor(FIXED_COLORS[0]);
  };

  const handleAdd = () => {
    if (!selectedProduct) return toast.error("Debe seleccionar un producto");
    if (!size) return toast.error("Debe seleccionar una talla");
    if (!color) return toast.error("Debe seleccionar un color");

    const item: IOrderItem = {
      orderId: "",
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      unitPrice: Number(selectedProduct.priceBase || 0),
      discountType: discountType.toUpperCase(),
      discountValue,
      attributes: [
        { name: "Color", value: color, unit: "" },
        { name: "Talla", value: size, unit: "" },
      ],
      observations: "",
    };

    onAdd(item);
    toast.success("Producto agregado al carrito");
    onClose();
  };

  return (
    <ModalContainer>
      <Header
        action={
          <Button onClick={onClose} variant="table" className="bg-red rounded-full">
            <X strokeWidth={4} />
          </Button>
        }
      >
        Agregar Producto
      </Header>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Producto</Label>
            <Select
              value={selectedProduct?.id || ""}
              onValueChange={handleProductChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Talla</Label>
            <Select onValueChange={setSize} value={size}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {FIXED_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color</Label>
            <Select onValueChange={setColor} value={color}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {FIXED_COLORS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Cantidad</Label>
            <Select
              value={String(quantity)}
              onValueChange={(v) => setQuantity(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo de Descuento</Label>
            <Select onValueChange={setDiscountType} value={discountType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PORCENTAJE">Porcentaje</SelectItem>
                <SelectItem value="MONTO">Monto fijo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor de Descuento</Label>
            <Select
              value={String(discountValue)}
              onValueChange={(v) => setDiscountValue(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {[0, 5, 10, 15, 20, 30].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num}
                    {discountType === "PORCENTAJE" ? "%" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>

      <div className="grid grid-cols-4 gap-4 w-full mt-4">
        <Button onClick={onClose} variant="outline" className="col-span-1">
          Cancelar
        </Button>
        <Button onClick={handleAdd} variant="lime" className="col-span-3">
          Agregar
        </Button>
      </div>
    </ModalContainer>
  );
};
