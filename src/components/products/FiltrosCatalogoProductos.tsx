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
import {
  ICategory,
  ISubCategory,
  IBrand,
  IProvider,
  IGroupedAttribute,
  ProductFilters,
  IProduct,
} from "./interfaces";
import { exportProductsToExcel } from "./utils/ExportExcel";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Props {
  filters: ProductFilters;
  categories: ICategory[];
  subcategories: ISubCategory[];
  brands: IBrand[];
  providers: IProvider[];
  groupedAttributes: Record<string, IGroupedAttribute>;
  hasActiveFilters: boolean;
  handleFilterChange: (
    key: keyof ProductFilters | `attribute_${string}`,
    value: string
  ) => void;
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
  providers,
  groupedAttributes,
  hasActiveFilters,
  handleFilterChange,
  setFilters,
  applyFilters,
  resetFilters,
  products,
}: Props) {
  const handleDownload = async () => {
    try {
      await exportProductsToExcel(products);
      toast.success("Archivo Excel descargado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el Excel");
    }
  };

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
            onValueChange={(value) =>
              handleFilterChange("subcategoryId", value)
            }
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
        {/* proveedores */}
        <div>
          <Label>Proveedores</Label>
          <Select
            value={filters.providerId}
            onValueChange={(value) => handleFilterChange("providerId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {Object.values(groupedAttributes).map((attr) => (
          <AnimatePresence key={attr.typeId}>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Label>{attr.typeName}</Label>
              <Select
                value={
                  (filters as ProductFilters)[`attribute_${attr.typeId}`] || ""
                }
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
            </motion.div>
          </AnimatePresence>
        ))}
      </FormGrid>

      {/* Botones */}
      <div className="flex justify-between gap-2 mt-4">
        <div className="flex gap-2">
          <Button onClick={applyFilters} variant="lime">
            <FilterIcon />
            Filtrar
          </Button>
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Button onClick={resetFilters} variant="outline">
                  Limpiar filtros
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button onClick={handleDownload}>
          Descargar Excel
          <Download />
        </Button>
      </div>
    </>
  );
}
