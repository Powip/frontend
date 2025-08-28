"use client";

import { useState } from "react";
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

const sampleProducts = [
  {
    codigo: 13,
    descripcion: "Pantalon Palazzo",
    color: "Blanco",
    talla: "L - Large",
    stock: 2,
    precioVenta: 269,
    marca: "Aranni",
    proveedor: "Burgenvilla",
    subcategoria: "Pantalon",
    categoria: "Ropa",
  },
  {
    codigo: 4,
    descripcion: "Pantalon Palazzo",
    color: "Negro",
    talla: "M - Medium",
    stock: 5,
    precioVenta: 180,
    marca: "Aranni",
    proveedor: "Burgenvilla",
    subcategoria: "Pantalon",
    categoria: "Ropa",
  },
  {
    codigo: 1,
    descripcion: "Pantalon Palazzo",
    color: "Negro",
    talla: "S - Small",
    stock: 3,
    precioVenta: 149,
    marca: "Aranni",
    proveedor: "Burgenvilla",
    subcategoria: "Pantalon",
    categoria: "Ropa",
  },
  {
    codigo: 23,
    descripcion: "Pantalón Sastre",
    color: "Blanco",
    talla: "L - Large",
    stock: 2,
    precioVenta: 180,
    marca: "Aranni",
    proveedor: "Burgenvilla",
    subcategoria: "Pantalon",
    categoria: "Ropa",
  },
  {
    codigo: 7,
    descripcion: "Pantalón Sastre",
    color: "Negro",
    talla: "M - Medium",
    stock: 3,
    precioVenta: 380,
    marca: "Aranni",
    proveedor: "Burgenvilla",
    subcategoria: "Pantalon",
    categoria: "Ropa",
  },
  {
    codigo: 14,
    descripcion: "Pantalón Sastre",
    color: "Negro",
    talla: "S - Small",
    stock: 4,
    precioVenta: 341,
    marca: "Aranni",
    proveedor: "Burgenvilla",
    subcategoria: "Pantalon",
    categoria: "Ropa",
  },
];

export default function Catalogo() {
  const [filters, setFilters] = useState({
    producto: "",
    categoria: "",
    subcategoria: "Pantalon",
    marca: "Aranni",
    proveedor: "",
    talla: "",
    color: "",
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
                <SelectItem value="ropa">Ropa</SelectItem>
                <SelectItem value="calzado">Calzado</SelectItem>
                <SelectItem value="accesorios">Accesorios</SelectItem>
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pantalon">Pantalon</SelectItem>
                <SelectItem value="camisa">Camisa</SelectItem>
                <SelectItem value="vestido">Vestido</SelectItem>
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Aranni">Aranni</SelectItem>
                <SelectItem value="zara">Zara</SelectItem>
                <SelectItem value="hm">H&M</SelectItem>
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
                <SelectItem value="burgenvilla">Burgenvilla</SelectItem>
                <SelectItem value="textiles-sa">Textiles SA</SelectItem>
                <SelectItem value="moda-ltda">Moda Ltda</SelectItem>
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
            {sampleProducts.map((product) => (
              <TableRow key={product.codigo} className=" hover:bg-gray-50">
                <TableCell className="font-medium">{product.codigo}</TableCell>
                <TableCell>{product.descripcion}</TableCell>
                <TableCell>{product.color}</TableCell>
                <TableCell>{product.talla}</TableCell>
                <TableCell>{product.stock}</TableCell>
                <TableCell>{product.precioVenta}</TableCell>
                <TableCell>{product.marca}</TableCell>
                <TableCell>{product.proveedor}</TableCell>
                <TableCell>{product.subcategoria}</TableCell>
                <TableCell>{product.categoria}</TableCell>
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
