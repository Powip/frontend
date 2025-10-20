"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

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
} from "@/src/components/ui/select";

import { Category, Subcategory } from "@/src/interfaces/ICategory";

import { getCategories } from "../../services/categoryService";

import SubcategoriesTable from "@/src/components/subcategories/SubcategoriesTable";

const CatalogoSubcategorias = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  // Traer categorías
  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data))
      .catch((err) => {
        toast.error("Error al cargar categorías");
        console.error(err);
      });
  }, []);

  // Traer subcategorías cuando cambia la categoría seleccionada
  useEffect(() => {
    if (!selectedCategory) {
      setSubcategories([]); // limpia si se deselecciona la categoría
      return;
    }

    // Buscar la categoría seleccionada en el estado actual
    const selected = categories.find((cat) => cat.id === selectedCategory);

    // Filtrar solo subcategorías activas
    const activeSubcategories =
      selected?.subcategories?.filter((s) => s.status) || [];

    setSubcategories(activeSubcategories);
  }, [selectedCategory, categories]);

  return (
    <Container>
      <Header className="mb-6">Catálogo de Subcategorías</Header>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Categoría</Label>
            <Select
              onValueChange={(value) => setSelectedCategory(value)}
              value={selectedCategory}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleccionar categoría" />
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
        </FormGrid>
      </FormContainer>

      {selectedCategory && (
        <div className="px-6 mt-4">
          <SubcategoriesTable
            subcategories={subcategories}
            categoryId={selectedCategory}
            onUpdated={() => {
              // Simplemente recargamos las categorías para actualizar la data completa
              getCategories().then(setCategories);
            }}
          />
        </div>
      )}

      {!selectedCategory && (
        <p className="text-xl text-center  text-gray-500  mb-6">
          Selecciona una categoría para ver sus subcategorías
        </p>
      )}
    </Container>
  );
};

export default CatalogoSubcategorias;
