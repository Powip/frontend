"use client";

import Container from "../ui/container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FiltersForm from "./FiltrosCatalogoProductos";
import ProductsTable from "./TablaCatalogoProductos";
import { useCatalogoProductos } from "@/src/hooks/useCatalogoProductos";
import FormGrid from "../ui/form-grid";
import { Button } from "../ui/button";
import ProductsTableSkeleton from "./SkeletonProductsTable";

export default function CatalogoProductos() {
  const {
    filters,
    products,
    categories,
    brands,
    providers,
    subcategories,
    groupedAttributes,
    isFetching,
    handleFilterChange,
    applyFilters,
    resetFilters,
    hasActiveFilters,
    setFilters,
  } = useCatalogoProductos();

  return (
    <Container>
      <Header>Catálogo de Productos</Header>

      <FormGrid>
        <div className="flex gap-3 justify-end px-8">
          <Button>Agregar Producto</Button>
          <Button>Importar Producto</Button>
        </div>
      </FormGrid>

      <FormContainer>
        <FiltersForm
          filters={filters}
          categories={categories}
          subcategories={subcategories}
          brands={brands}
          groupedAttributes={groupedAttributes}
          hasActiveFilters={hasActiveFilters}
          handleFilterChange={handleFilterChange}
          setFilters={setFilters}
          applyFilters={applyFilters}
          resetFilters={resetFilters}
          products={products}
          providers={providers}
        />
      </FormContainer>

      <div className="px-6">
        {isFetching ? (
          <ProductsTableSkeleton />
        ) : (
          <ProductsTable
            products={products}
            onDelete={(id) => console.log("Eliminar", id)}
            onEdit={(id) => console.log("Editar", id)}
          />
        )}
      </div>
    </Container>
  );
}
