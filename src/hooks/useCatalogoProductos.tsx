"use client";

import { useMemo, useState } from "react";
import { QueryClient, useMutation, useQuery} from "@tanstack/react-query";
import {
  getCategories,
  getSubCategories,
  getBrands,
  getProducts,
  getAttributesBySubcategory,
  deleteProduct,
} from "@/src/api/Productos";
import {
  ICategory,
  ISubCategory,
  IBrand,
  IProduct,
  IAttribute,
  IAttributesGroupedMap,
  ProductFilters,
} from "@/src/components/products/interfaces";
import { AxiosError } from "axios";

const initialFilters: ProductFilters = {
  name: "",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  status: true,
};

export function useCatalogoProductos() {
  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  // Queries
  const { data: categories = [] } = useQuery<ICategory[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: subcategories = [] } = useQuery<ISubCategory[]>({
    queryKey: ["subcategories"],
    queryFn: getSubCategories,
  });

  const { data: brands = [] } = useQuery<IBrand[]>({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const { data: products = [], isFetching } = useQuery<IProduct[]>({
    queryKey: ["products", appliedFilters],
    queryFn: () => getProducts(appliedFilters),
  });

  const { data: attributes = [] } = useQuery({
    queryKey: ["attributes", filters.subcategoryId],
    queryFn: () => getAttributesBySubcategory(filters.subcategoryId),
    enabled: !!filters.subcategoryId,
  });

 
const deleteMutation = useMutation<void, AxiosError, string>({
  mutationFn: (id: string) => deleteProduct(id),
  onSuccess: () => {
    const queryClient = new QueryClient();
    queryClient.invalidateQueries({ queryKey: ["products"] });
  },
  onError: (error) => {
    const err = error as AxiosError<{ message: string }>;
    alert(err.response?.data?.message || "Error al eliminar producto");
  },
});

  // Agrupación de atributos dinámicos
  const groupedAttributes = useMemo(() => {
    return attributes.reduce((acc: IAttributesGroupedMap, attr: IAttribute) => {
      const typeId = attr.attributeType.id;
      if (!acc[typeId]) {
        acc[typeId] = {
          typeId,
          typeName: attr.attributeType.name,
          values: [],
        };
      }
      acc[typeId].values.push({ id: attr.id, name: attr.name });
      return acc;
    }, {});
  }, [attributes]);

  // Handlers
  const handleFilterChange = (
    key: keyof ProductFilters | `attribute_${string}`,
    value: string
  ) => {
    setFilters((prev) => {
      const newFilters: ProductFilters = { ...prev, [key]: value };

      if (key === "categoryId") newFilters.subcategoryId = "";

      if (key === "subcategoryId") {
        Object.keys(newFilters).forEach((k) => {
          if (k.startsWith("attribute_")) {
            delete newFilters[k as `attribute_${string}`];
          }
        });
      }

      return newFilters;
    });
  };

  const applyFilters = () => setAppliedFilters(filters);

  const resetFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  };

  const filteredSubcategories = filters.categoryId
    ? subcategories.filter((sub) => sub.category.id === filters.categoryId)
    : subcategories;

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(initialFilters);

  return {
    filters,
    products,
    categories,
    brands,
    subcategories: filteredSubcategories,
    groupedAttributes,
    isFetching,
    handleFilterChange,
    applyFilters,
    resetFilters,
    hasActiveFilters,
    setFilters,
    deleteProduct: deleteMutation.mutate,
  isDeleting: deleteMutation.isPending, 
  };
}
