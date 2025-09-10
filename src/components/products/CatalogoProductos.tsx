"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Download, Edit, FilterIcon, Trash } from "lucide-react";
import Header from "../ui/header";
import Container from "../ui/container";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";

// Fetchers
import {
  getCategories,
  getSubCategories,
  getBrands,
  getCompanies,
  getProducts,
} from "@/src/api/Productos";


interface ICategories{
  id: string;
  name: string;
}

interface ISubCategories{
  id: string;
  name: string;
}

interface IBrand{
  id: string;
  name: string;
}

interface ICompany{
  id: string;
  name: string;
}

interface IProduct {
  id: string;
  sku: string;
  name: string;
  attribute2: string;
  size: string;
  stock: number;
  price: number;
  brand?: IBrand | null;
  company?: ICompany | null;
  subcategory?: ISubCategories | null;
  category?: ICategories | null;
}


export default function CatalogoProductos() {
  const [filters, setFilters] = useState({
    producto: "",
    categoria: "",
    subcategoria: "",
    marca: "",
    proveedor: "",
    talla: "",
    color: "",
  });

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ["subcategories"],
    queryFn: getSubCategories,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: getBrands,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Container>
      {/* Header */}
      <Header>Catálogo de Productos</Header>

      <div className="px-8 flex justify-end gap-5">
        <Button variant="default">Cargar Producto</Button>
        <Button>Importar Productos</Button>
      </div>

      {/* Filter Section */}
      <FormContainer>
        <FormGrid>
          {/* Producto */}
          <div>
            <Label>Producto</Label>
            <Input
              value={filters.producto}
              onChange={(e) => handleFilterChange("producto", e.target.value)}
              placeholder=""
            />
          </div>

          {/* Categoria */}
          <div>
            <Label>Categoría</Label>
            <Select
              value={filters.categoria}
              onValueChange={(value) => handleFilterChange("categoria", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: ICategories) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SubCategoria */}
          <div>
            <Label>SubCategoría</Label>
            <Select
              value={filters.subcategoria}
              onValueChange={(value) =>
                handleFilterChange("subcategoria", value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {subcategories.map((sub: ISubCategories) => (
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
              value={filters.marca}
              onValueChange={(value) => handleFilterChange("marca", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand: IBrand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          {/* Proveedor */}
          <div>
            <Label>Proveedor</Label>
            <Select
              value={filters.proveedor}
              onValueChange={(value) => handleFilterChange("proveedor", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((comp: ICompany) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Talla */}
          <div>
            <Label>Talla</Label>
            <Select
              value={filters.talla}
              onValueChange={(value) => handleFilterChange("talla", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s">S - Small</SelectItem>
                <SelectItem value="m">M - Medium</SelectItem>
                <SelectItem value="l">L - Large</SelectItem>
                <SelectItem value="xl">XL - Extra Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div>
            <Label>Color</Label>
            <Select
              value={filters.color}
              onValueChange={(value) => handleFilterChange("color", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blanco">Blanco</SelectItem>
                <SelectItem value="negro">Negro</SelectItem>
                <SelectItem value="azul">Azul</SelectItem>
                <SelectItem value="rojo">Rojo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        {/* Buttons */}
        <div className="flex justify-between">
          <Button variant="lime">
            <FilterIcon />
            Filtrar
          </Button>
          <Button>
            Descargar Excel
            <Download />
          </Button>
        </div>
      </FormContainer>

      {/* Products Table */}
      <div className="px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Precio Venta</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Subcategoría</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product: IProduct) => (
              <TableRow key={product.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">{product.sku}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.attribute2}</TableCell>
                <TableCell>{product.price}</TableCell>
                <TableCell>{product.brand?.name}</TableCell>
                <TableCell>{product.company?.name}</TableCell>
                <TableCell>{product.subcategory?.name}</TableCell>
                <TableCell>{product.category?.name}</TableCell>
                <TableActions>
                  <Button variant="table" size="icon" className="bg-lime">
                    <Edit />
                  </Button>
                  <Button variant="table" size="icon" className="bg-red">
                    <Trash />
                  </Button>
                </TableActions>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Container>
  );
}
