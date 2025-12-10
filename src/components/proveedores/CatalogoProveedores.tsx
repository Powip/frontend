"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import Container from "../ui/container";
import Header from "../ui/header";
import FormGrid from "../ui/form-grid";
import FormContainer from "../ui/form-container";

import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";

import { Provider } from "@/interfaces/IProvider";
import {
  getProvidersByCompany,
  getProviderById,
  inactivateProvider,
} from "@/services/providerService";

import ProvidersTable from "../../components/proveedores/ProvidersTable";
import DeleteProviderModal from "./DeleteProviderModal";
import { Label } from "../ui/label";

const CatalogoProveedores = () => {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);

  const [filterRuc, setFilterRuc] = useState("");
  const [filterName, setFilterName] = useState("");

  const companyId = "5d5b824c-2b81-4b17-960f-855bfc7806e2";
  const [providerToDelete, setProviderToDelete] = useState<null | {
    id: string;
    name: string;
    ruc: string;
  }>(null);

  //Traer todos los Proveedores de la Compañía
  useEffect(() => {
    getProvidersByCompany(companyId)
      .then((data) => setProviders(data))
      .catch((err) => {
        toast.error("No se pudieron cargar los proveedores");
        console.error(err);
      });
  }, []);

  // Filtro dinámico
  const filteredProviders = providers.filter((prov) => {
    const matchesRuc = prov.ruc.toLowerCase().includes(filterRuc.toLowerCase());
    const matchesName = prov.name
      .toLowerCase()
      .includes(filterName.toLowerCase());
    return matchesRuc && matchesName;
  });

  //Handles Eliminación Proveedor por ID
  const handleDeleteClick = async (id: string) => {
    try {
      const provider = await getProviderById(id);
      setProviderToDelete(provider);
      console.log(providerToDelete);
    } catch (error) {
      console.error("Error al obtner el proveedor:", error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!providerToDelete) return;
    try {
      await inactivateProvider(providerToDelete.id);
      toast.success("Producto creado con éxito");
      //refrescar catálogo
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar");
    } finally {
      setProviderToDelete(null);
    }
  };

  return (
    <Container>
      <Header className="mb-6">Catálogo de Proveedores</Header>

      <FormGrid>
        <div className="flex gap-3 justify-end px-8">
          <Button variant="default" asChild>
            <Link href="/proveedores/nuevo">Cargar Proveedor</Link>
          </Button>
        </div>
      </FormGrid>

      {/* Filtros */}
      <FormContainer>
        <FormGrid>
          <div>
            <Label>RUC / DNI*</Label>
            <Input
              name="ruc"
              placeholder="RUC o DNI"
              value={filterRuc}
              onChange={(e) => setFilterRuc(e.target.value)}
            />
          </div>
          <div>
            <Label>Razón Social*</Label>
            <Input
              name="name"
              placeholder="Razón Social"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
        </FormGrid>
      </FormContainer>

      <div className="px-6">
        <ProvidersTable
          providers={filteredProviders}
          onDelete={handleDeleteClick}
          onEdit={(id) => router.push(`/proveedores/${id}/edit`)}
          onView={(id) => router.push(`/proveedores/${id}/view`)}
        />
      </div>
      {providerToDelete && (
        <DeleteProviderModal
          provider={providerToDelete}
          onCancel={() => setProviderToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </Container>
  );
};

export default CatalogoProveedores;
