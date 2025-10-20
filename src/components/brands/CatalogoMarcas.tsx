"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import Container from "../ui/container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/src/components/ui/select";

import { Brand, Provider } from "@/src/interfaces/IProvider";

import { getProvidersByCompany } from "@/src/services/providerService";
import { getBrandsBySupplier } from "@/src/services/brandService";

import BrandsTable from "../brands/BrandsTable";

const CatalogoMarcas = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [brands, setBrands] = useState<Brand[]>([]);

  const companyId = "5d5b824c-2b81-4b17-960f-855bfc7806e2";

  // Traer proveedores
  useEffect(() => {
    getProvidersByCompany(companyId)
      .then((data) => setProviders(data))
      .catch((err) => {
        toast.error("Error al cargar proveedores");
        console.error(err);
      });
  }, []);

  // Cargar marcas cuando cambia el proveedor seleccionado
  useEffect(() => {
    if (!selectedProvider) return;
    getBrandsBySupplier(selectedProvider)
      .then((data) => setBrands(data))
      .catch((err) => {
        toast.error("Error al cargar marcas");
        console.error(err);
      });
  }, [selectedProvider]);

  return (
    <Container>
      <Header className="mb-6">Catálogo de Marcas</Header>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Proveedor</Label>
            <Select
              onValueChange={(value) => setSelectedProvider(value)}
              value={selectedProvider}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers
                  .filter((prov) => prov.is_active)
                  .map((prov) => (
                    <SelectItem key={prov.id} value={prov.id!}>
                      {prov.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>

      {selectedProvider && (
        <div className="px-6 mt-4">
          <BrandsTable
            brands={brands}
            supplierId={selectedProvider}
            onUpdated={() => {
              getBrandsBySupplier(selectedProvider).then(setBrands);
            }}
          />
        </div>
      )}

      {!selectedProvider && (
        <p className="text-xl text-center  text-gray-500  mb-6">
          Selecciona un proveedor para ver sus marcas
        </p>
      )}
    </Container>
  );
};

export default CatalogoMarcas;
