"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ModalContainer from "../ui/modal-container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { IAddItem } from "@/api/Interfaces";
import { IProduct } from "../products/interfaces";
import { getAttributesBySubcategory } from "@/api/Productos";
import { Label } from "../ui/label";

type Props = {
  onClose: () => void;
  onAdd: (item: IAddItem) => void;
  products: IProduct[];
};

interface IGroupedAttribute {
  typeId: string;
  typeName: string;
  values: { id: string; name: string }[];
}

interface IGroupedAttribute {
  typeId: string;
  typeName: string;
  values: { id: string; name: string }[];
}

export const AgregarProducto = ({ onClose, onAdd, products }: Props) => {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [discountType, setDiscountType] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});

  // Producto seleccionado
  const productObj = useMemo(
    () => products.find((p) => p.id === selectedProduct),
    [selectedProduct, products]
  );

  // Traer atributos dinámicos según la subcategoría
  const { data: attributes = [], isLoading } = useQuery({
    queryKey: ["attributes", productObj?.subcategory?.id],
    queryFn: () => getAttributesBySubcategory(productObj!.subcategory!.id),
    enabled: !!productObj?.subcategory?.id,
  });

  // Agrupar atributos por tipo
  const groupedAttributes: Record<string, IGroupedAttribute> = useMemo(() => {
    if (!attributes?.length) return {};

    const grouped = attributes.reduce(
      (
        acc: Record<string, IGroupedAttribute>,
        attr: {
          attributeType: { id: string; name: string };
          id: string;
          name: string;
        }
      ) => {
        const typeId = attr.attributeType?.id;
        const typeName = attr.attributeType?.name || "Sin nombre";
        if (!typeId) return acc;

        if (!acc[typeId]) {
          acc[typeId] = { typeId, typeName, values: [] };
        }

        acc[typeId].values.push({ id: attr.id, name: attr.name });
        return acc;
      },
      {}
    );

    // Log detallado de los groupedAttributes
    (Object.values(grouped) as IGroupedAttribute[]).forEach((group) => {
      group.values.forEach((v) => {
        console.log("GroupedAttribute:", group.typeName, v.id, v.name);
      });
    });

    return grouped;
  }, [attributes]);

  // Acción para agregar producto
  const handleAdd = () => {
    if (!productObj) return;

    const attributesArray = Object.entries(selectedAttributes).map(
      ([typeId, attrId]) => {
        const group = groupedAttributes[typeId];
        const valueObj = group?.values.find(
          (v: { id: string }) => v.id === attrId
        );
        return {
          name: group?.typeName || "Desconocido",
          value: valueObj?.name || "N/A",
        };
      }
    );

    const item: IAddItem = {
      productId: productObj.id,
      productName: productObj.name,
      quantity,
      unitPrice: Number(productObj.priceBase) || 0,
      discountType,
      discountValue,
      attributes: attributesArray,
    };

    console.log("Producto final a agregar:", item);
    onAdd(item);
  };

  // Log de productos para rastrear duplicados
  useEffect(() => {
    console.log(
      "Productos renderizados:",
      products.map((p) => p.id)
    );
  }, [products]);

  return (
    <ModalContainer>
      <Header
        action={
          <Button onClick={onClose} className="bg-red rounded-full">
            <X strokeWidth={4} />
          </Button>
        }
      >
        Agregar Producto
      </Header>

      <FormContainer>
        {/* Selección de producto */}
        <FormGrid>
          <div>
            <Label>Producto</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((prod, index) => (
                  <SelectItem key={`prod-${prod.id}-${index}`} value={prod.id}>
                    {prod.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        {/* Atributos dinámicos */}
        <FormGrid>
          {isLoading ? (
            <p className="text-sm text-gray-400 mt-2">Cargando atributos...</p>
          ) : (
            Object.values(groupedAttributes).map((attrGroup, groupIndex) => (
              <div key={`${attrGroup.typeId}-${groupIndex}`} className="mt-2">
                <Label>{attrGroup.typeName}</Label>
                <Select
                  value={selectedAttributes[attrGroup.typeId] || ""}
                  onValueChange={(val) =>
                    setSelectedAttributes((prev) => ({
                      ...prev,
                      [attrGroup.typeId]: val,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={`Seleccionar ${attrGroup.typeName}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {attrGroup.values.map(
                      (
                        val: {
                          id: string;
                          name:
                            | string
                            | number
                            | bigint
                            | boolean
                            | React.ReactElement<
                                unknown,
                                string | React.JSXElementConstructor<unknown>
                              >
                            | Iterable<React.ReactNode>
                            | React.ReactPortal
                            | Promise<
                                | string
                                | number
                                | bigint
                                | boolean
                                | React.ReactPortal
                                | React.ReactElement<
                                    unknown,
                                    | string
                                    | React.JSXElementConstructor<unknown>
                                  >
                                | Iterable<React.ReactNode>
                                | null
                                | undefined
                              >
                            | null
                            | undefined;
                        },
                        valIndex: unknown
                      ) => (
                        <SelectItem
                          key={`${attrGroup.typeId}-${val.id}-${valIndex}`}
                          value={val.id}
                        >
                          {val.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </FormGrid>

        {/* Cantidad y descuentos */}
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
                {[1, 2, 3, 4, 5].map((num, index) => (
                  <SelectItem key={`qty-${num}-${index}`} value={String(num)}>
                    {num}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo de Descuento</Label>
            <Select
              value={discountType || ""}
              onValueChange={(v) => setDiscountType(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem key="disc-porcentaje" value="porcentaje">
                  Porcentaje
                </SelectItem>
                <SelectItem key="disc-monto" value="monto">
                  Monto fijo
                </SelectItem>
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
                {[0, 5, 10, 15, 20, 30].map((num, index) => (
                  <SelectItem
                    key={`discval-${num}-${index}`}
                    value={String(num)}
                  >
                    {num}
                    {discountType === "porcentaje" ? "%" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>

      {/* Botones */}
      <div className="grid grid-cols-4 gap-4 w-full mt-4">
        <Button onClick={onClose} variant="outline" className="col-span-1">
          Cancelar
        </Button>
        <Button
          onClick={handleAdd}
          className="col-span-3"
          disabled={!selectedProduct}
        >
          Agregar
        </Button>
      </div>
    </ModalContainer>
  );
};
