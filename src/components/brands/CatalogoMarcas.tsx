"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Brand, Provider } from "@/interfaces/IProvider";
import { getProvidersByCompany } from "@/services/providerService";
import { getBrandsBySupplier } from "@/services/brandService";
import BrandsTable from "../brands/BrandsTable";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const CatalogoMarcas = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  // Traer proveedores
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    getProvidersByCompany(companyId)
      .then((data) => setProviders(data))
      .catch((err) => {
        toast.error("Error al cargar proveedores");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

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

  if (!companyId) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium">Catálogo de Marcas</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona las marcas asociadas a tus proveedores
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            {loading ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Cargando proveedores...
                </span>
              </div>
            ) : (
              <Select
                onValueChange={(value) => setSelectedProvider(value)}
                value={selectedProvider}
              >
                <SelectTrigger>
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
            )}
          </div>
        </div>
      </div>

      {selectedProvider && (
        <div className="rounded-lg border bg-card">
          <div className="p-6">
            <BrandsTable
              brands={brands}
              supplierId={selectedProvider}
              onUpdated={() => {
                getBrandsBySupplier(selectedProvider).then(setBrands);
              }}
            />
          </div>
        </div>
      )}

      {!selectedProvider && !loading && (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
          <p className="text-muted-foreground">
            Selecciona un proveedor para ver y gestionar sus marcas
          </p>
        </div>
      )}
    </div>
  );
};

export default CatalogoMarcas;
