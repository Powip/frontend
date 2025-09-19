"use client";

import Container from "../ui/container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FiltersForm from "./FiltrosCatalogoProductos";
import ProductsTable from "./TablaCatalogoProductos";
import { useCatalogoProductos } from "@/src/hooks/useCatalogoProductos"; 
import { deleteProduct } from "@/src/api/Productos";
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

  const handleDelete = (id: string) => {
    if (confirm("¿Seguro que deseas eliminar este producto?")) {
      deleteProduct(id);
    }
  };

  return (
    <Container>
      <Header>Catálogo de Productos</Header>

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
    <ProductsTable products={products} onDelete={handleDelete} />
  )}
</div>

    </Container>
  );
}
