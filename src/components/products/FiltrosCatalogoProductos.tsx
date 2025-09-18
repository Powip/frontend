"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import Label from "@/src/components/ui/label";
import FormGrid from "@/src/components/ui/form-grid";
import { FilterIcon, Download } from "lucide-react";
import { ICategory, ISubCategory, IBrand, IGroupedAttribute, ProductFilters, IProduct } from "./interfaces";
import { exportProductsToExcel } from "./utils/ExportExcel";

interface Props {
  filters: ProductFilters;
  categories: ICategory[];
  subcategories: ISubCategory[];
  brands: IBrand[];
  groupedAttributes: Record<string, IGroupedAttribute>;
  hasActiveFilters: boolean;
  handleFilterChange: (key: keyof ProductFilters | `attribute_${string}`, value: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<ProductFilters>>;
  applyFilters: () => void;
  resetFilters: () => void;
  products: IProduct[];
}

export default function FiltersForm({
  filters,
  categories,
  subcategories,
  brands,
  groupedAttributes,
  hasActiveFilters,
  handleFilterChange,
  setFilters,
  applyFilters,
  resetFilters,
  products,
}: Props) {
  return (
    <>
      <FormGrid>
        {/* Producto */}
        <div>
          <Label>Producto</Label>
          <Input
            value={filters.name}
            onChange={(e) => handleFilterChange("name", e.target.value)}
            placeholder="Buscar por nombre"
          />
        </div>

        {/* Categoría */}
        <div>
          <Label>Categoría</Label>
          <Select
            value={filters.categoryId}
            onValueChange={(value) => handleFilterChange("categoryId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subcategoría */}
        <div>
          <Label>Subcategoría</Label>
          <Select
            value={filters.subcategoryId}
            onValueChange={(value) => handleFilterChange("subcategoryId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Marca */}
        <div>
          <Label>Marca</Label>
          <Select
            value={filters.brandId}
            onValueChange={(value) => handleFilterChange("brandId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormGrid>

      {/* Atributos dinámicos */}
      <FormGrid>
        {Object.values(groupedAttributes).map((attr) => (
          <div key={attr.typeId}>
            <Label>{attr.typeName}</Label>
            <Select
              value={(filters as ProductFilters)[`attribute_${attr.typeId}`] || ""}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  [`attribute_${attr.typeId}`]: value,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {attr.values.map((val) => (
                  <SelectItem key={val.id} value={val.id}>
                    {val.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </FormGrid>

      {/* Botones */}
      <div className="flex justify-between gap-2 mt-4">
        <div className="flex gap-2">
          <Button onClick={applyFilters} variant="lime">
            <FilterIcon />
            Filtrar
          </Button>
          {hasActiveFilters && (
            <Button onClick={resetFilters} variant="outline">
              Limpiar filtros
            </Button>
          )}
        </div>
        <Button onClick={() => exportProductsToExcel(products)}>
          Descargar Excel
          <Download />
        </Button>
      </div>
    </>
  );
}
