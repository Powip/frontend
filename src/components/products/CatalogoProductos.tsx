"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Container from "../ui/container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FiltersForm from "./FiltrosCatalogoProductos";
import ProductsTable from "./TablaCatalogoProductos";
import FormGrid from "../ui/form-grid";
import { Button } from "../ui/button";

import { useCatalogoProductos } from "@/hooks/useCatalogoProductos";
import ProductsTableSkeleton from "./SkeletonProductsTable";

import { deleteProduct, getProductById } from "../../services/productService";
import { deleteProductVariants } from "../../services/productVariantService";

import DeleteProductModal from "./DeleteProductModal";
import ProductViewModal from "./ProductViewModal";

export default function CatalogoProductos() {
  const router = useRouter();
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

  const [openView, setOpenView] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<
    string | undefined
  >();

  const handleViewClick = (id: string) => {
    setSelectedProductId(id);
    setOpenView(true);
  };

  const [productToDelete, setProductToDelete] = useState<null | {
    id: string;
    name: string;
    sku: string;
  }>(null);

  const handleDeleteClick = async (id: string) => {
    try {
      const product = await getProductById(id);
      setProductToDelete(product);
    } catch (error) {
      console.error("Error al obtener producto:", error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProductVariants(productToDelete.id);
      await deleteProduct(productToDelete.id);

      // refrescar catálogo
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar");
    } finally {
      setProductToDelete(null);
    }
  };

  return (
    <Container>
      <Header>Catálogo de Productos</Header>

      <FormGrid>
        <div className="flex gap-3 justify-end px-8">
          <Button variant="default" asChild>
            <Link href="/productos/nuevo">Cargar Producto</Link>
          </Button>
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
            onDelete={handleDeleteClick}
            onEdit={(id) => router.push(`/productos/${id}/edit`)}
            onView={(id) => handleViewClick(id)}
          />
        )}
      </div>

      <ProductViewModal
        open={openView}
        onClose={() => setOpenView(false)}
        productId={selectedProductId}
      />
      {productToDelete && (
        <DeleteProductModal
          product={productToDelete}
          onCancel={() => setProductToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </Container>
  );
}
