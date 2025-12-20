"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProviderById } from "@/services/providerService";
import { Provider } from "@/interfaces/IProvider";

import Container from "../ui/container";
import Header from "../ui/header";
import { Button } from "@/components/ui/button";

const ViewProvider = () => {
  const { id } = useParams();
  const router = useRouter();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        if (id) {
          const data = await getProviderById(id as string);
          setProvider(data);
        }
      } catch (error) {
        console.error("Error al obtener proveedor:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [id]);

  if (loading) {
    return <p className="text-center mt-10">Cargando datos del proveedor...</p>;
  }

  if (!provider) {
    return <p className="text-center mt-10">Proveedor no encontrado.</p>;
  }

  return (
    <Container>
      <Header>Datos Proveedor</Header>

      <div className="bg-white shadow-lg rounded-2xl p-8 space-y-6 mt-1 border border-gray-100">
        {/* DATOS PRINCIPALES */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3 border-b pb-1">
            Datos principales
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
            <p className="text-xl">
              <strong>Razón Social:</strong> {provider.name}
            </p>
            <p className="text-xl">
              <strong>RUC:</strong> {provider.ruc}
            </p>
            <p className="text-xl">
              <strong>Observaciones:</strong> {provider.description}
            </p>
            <p className="text-xl">
              <strong>Web:</strong>{" "}
              <a
                href={provider.webUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {provider.webUrl}
              </a>
            </p>
          </div>
        </section>

        {/* CONTACTO */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3 border-b pb-1">
            Contacto
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
            <p className="text-xl">
              <strong>Contacto:</strong> {provider.contact}
            </p>
            <p className="text-xl">
              <strong>Email:</strong> {provider.email}
            </p>
            <p className="text-xl">
              <strong>Teléfono:</strong> {provider.phone_number}
            </p>
            <p>
              <strong>Celular:</strong> {provider.cell_phone}
            </p>
          </div>
        </section>

        {/* UBICACIÓN */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3 border-b pb-1">
            Ubicación
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
            <p className="text-xl">
              <strong>Dirección:</strong> {provider.address}
            </p>
            <p className="text-xl">
              <strong>Distrito:</strong> {provider.district}
            </p>
            <p className="text-xl">
              <strong>Provincia:</strong> {provider.province}
            </p>
            <p className="text-xl">
              <strong>Departamento:</strong> {provider.departament}
            </p>
            <p className="text-xl">
              <strong>País:</strong> {provider.country}
            </p>
            <p className="text-xl">
              <strong>Código Postal:</strong> {provider.zipCode}
            </p>
          </div>
        </section>

        {/* ACCIONES */}
        <div className="flex justify-end gap-4 mt-8">
          <Button variant="default" onClick={() => router.back()}>
            Volver
          </Button>
          <Button
            variant="default"
            onClick={() => router.push(`/proveedores/${id}/edit`)}
          >
            Editar
          </Button>
        </div>
      </div>
    </Container>
  );
};

export default ViewProvider;
