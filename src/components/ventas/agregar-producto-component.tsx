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
import { IProduct } from "../products/interfaces";

type Props = {
  onClose: () => void;
  products: IProduct[];
};

export const AgregarProducto = ({ onClose, products }: Props) => {
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  return (
    <ModalContainer>
      <Header
        action={
          <Button
            onClick={onClose}
            variant="table"
            className="bg-red rounded-full"
          >
            <X strokeWidth={4} />
          </Button>
        }
      >
        Agregar Producto
      </Header>
      <FormContainer>
        <FormGrid>
          {/* Producto */}
          <div>
            <Label>Producto</Label>
            <Select
              value={selectedProduct}
              onValueChange={(value) => setSelectedProduct(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((prod) => (
                  <SelectItem key={prod.id} value={prod.id}>
                    {prod.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
        {/* resto del formulario */}
        <FormGrid>
          <div>
            <Label>Talla*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s">S</SelectItem>
                <SelectItem value="m">M</SelectItem>
                <SelectItem value="l">L</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Color*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rojo">Rojo</SelectItem>
                <SelectItem value="azul">Azul</SelectItem>
                <SelectItem value="verde">Verde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Cantidad*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((num) => (
                  <SelectItem key={num} value={String(num)}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Descuento*</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="porcentaje">Porcentaje</SelectItem>
                <SelectItem value="monto">Monto fijo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descuento</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="30">30%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>
      <div className="grid grid-cols-4 gap-15 w-full">
        <Button onClick={onClose} variant="outline" className="col-span-1">
          Cancelar
        </Button>
        <Button variant="lime" className="col-span-3">
          Agregar
        </Button>
      </div>
    </ModalContainer>
  );
};
