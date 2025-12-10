"use client";
import { FormEvent, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

import { Toaster, toast } from "sonner";

import Header from "../ui/header";
import Container from "../ui/container";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ProviderRequest } from "@/interfaces/IProvider";

import {
  getDepartments,
  getProvinces,
  getDistricts,
} from "@/services/geoPeruService";

import { getProviderById, updateProvider } from "@/services/providerService";
import { Label } from "../ui/label";

const EditProveedor = () => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);

  //Proveedor que traemos de la BD
  const [provider, setProvider] = useState({
    name: "",
    ruc: "",
    phone_number: "",
    cell_phone: "",
    company_id: "5d5b824c-2b81-4b17-960f-855bfc7806e2",
    contact: "",
    address: "",
    country: "",
    departament: "",
    province: "",
    district: "",
    zipCode: "",
    webUrl: "",
    email: "",
    description: "",
    is_active: true,
  });

  const [departments, setDepartments] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  // 🔹 Cargar departamentos iniciales
  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch((err) => console.error(err));
  }, []);

  // 🔹 Cargar proveedor por ID
  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const data = await getProviderById(id);
        setProvider(data);

        // Cargar provincias y distritos si ya existen en el proveedor
        if (data.departament) {
          const provs = await getProvinces(data.departament);
          setProvinces(provs);
        }

        if (data.province) {
          const dists = await getDistricts(data.province);
          setDistricts(dists);
        }
      } catch (error) {
        console.error("Error al traer proveedor:", error);
        toast.error("Error al cargar los datos del proveedor");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProvider();
  }, [id]);

  // 🔹 Cargar provincias al cambiar departamento
  useEffect(() => {
    if (!provider.departament) return;
    getProvinces(provider.departament)
      .then((data) => {
        setProvinces(data);
        setDistricts([]);
      })
      .catch((err) => console.error(err));
  }, [provider.departament]);

  // 🔹 Cargar distritos al cambiar provincia
  useEffect(() => {
    if (!provider.province) return;
    getDistricts(provider.province)
      .then(setDistricts)
      .catch((err) => console.error(err));
  }, [provider.province]);

  // 🔹 Handle change
  const handleChange = (key: string, value: string) => {
    setProvider((prev) => ({ ...prev, [key]: value }));
  };

  /* HandleSubmit  */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 1️⃣ Crear payload del Proveedor
    const payload: ProviderRequest = {
      name: provider.name,
      ruc: provider.ruc,
      phone_number: provider.phone_number,
      cell_phone: provider.cell_phone,
      company_id: provider.company_id,
      contact: provider.contact,
      address: provider.address,
      country: provider.country,
      departament: provider.departament,
      province: provider.province,
      district: provider.district,
      zipCode: provider.zipCode,
      webUrl: provider.webUrl,
      email: provider.email,
      description: provider.description,
      is_active: provider.is_active,
    };

    try {
      // 2️⃣ Modificar el proveedor
      await updateProvider(id, payload);
      toast.success("Proveedor actualizado correctamente");
      //refrescar catálogo
      //window.location.reload();
      router.push("/proveedores");
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar");
    }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <Container>
      <Toaster richColors />
      <form onSubmit={handleSubmit}>
        <Header className="mb-6">Editar Proveedor</Header>
        <FormContainer className="mb-6">
          <FormGrid>
            {/* RUC o DNI */}
            <div>
              <Label>RUC / DNI*</Label>
              <Input
                name="ruc"
                value={provider.ruc}
                onChange={(e) => handleChange("ruc", e.target.value)}
                placeholder="RUC o DNI"
              />
            </div>

            {/* Razón Social */}
            <div>
              <Label>Razón Social*</Label>
              <Input
                name="name"
                value={provider.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Razon Social"
              />
            </div>
          </FormGrid>

          <FormGrid>
            {/* Contacto */}
            <div>
              <Label>Contacto</Label>
              <Input
                name="contact"
                value={provider.contact}
                onChange={(e) => handleChange("contact", e.target.value)}
                placeholder="Contacto"
              />
            </div>

            {/* Teléfono */}
            <div>
              <Label>Teléfono</Label>
              <Input
                name="phone_number"
                value={provider.phone_number}
                onChange={(e) => handleChange("phone_number", e.target.value)}
                placeholder="Teléfono"
              />
            </div>

            {/* Celular */}
            <div>
              <Label>Celular</Label>
              <Input
                name="cell_phone"
                value={provider.cell_phone}
                onChange={(e) => handleChange("cell_phone", e.target.value)}
                placeholder="Celular"
              />
            </div>
          </FormGrid>
        </FormContainer>

        <FormContainer className="mb-6">
          <FormGrid>
            {/* Dirección */}
            <div>
              <Label>Dirección</Label>
              <Input
                name="address"
                value={provider.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Dirección"
              />
            </div>

            {/* País */}
            <div>
              <Label>País*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="country"
                  value={provider.country}
                  onValueChange={(value) => handleChange("country", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Perú">Perú</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormGrid>

          <FormGrid>
            {/* Departamento */}
            <div>
              <Label>Departamento*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="departament"
                  value={provider.departament}
                  onValueChange={(value) => handleChange("departament", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dep) => (
                      <SelectItem key={dep} value={dep}>
                        {dep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Provincia */}
            <div>
              <Label>Provincia*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="province"
                  value={provider.province}
                  onValueChange={(value) => handleChange("province", value)}
                  disabled={!provider.departament}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((prov) => (
                      <SelectItem key={prov} value={prov}>
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Distrito */}
            <div>
              <Label>Distrito*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="district"
                  value={provider.district}
                  onValueChange={(value) => handleChange("district", value)}
                  disabled={!provider.province}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((dist) => (
                      <SelectItem key={dist} value={dist}>
                        {dist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Código Postal */}
            <div>
              <Label>Código Postal</Label>
              <Input
                name="zipCode"
                value={provider.zipCode}
                onChange={(e) => handleChange("zipCode", e.target.value)}
                placeholder="Código Postal"
              />
            </div>
          </FormGrid>
        </FormContainer>

        <FormContainer className="mb-6">
          <FormGrid>
            {/* Web */}
            <div>
              <Label>Web</Label>
              <Input
                name="webUrl"
                value={provider.webUrl}
                onChange={(e) => handleChange("webUrl", e.target.value)}
                placeholder="Web"
              />
            </div>

            {/* Email */}
            <div>
              <Label>Email*</Label>
              <Input
                name="email"
                value={provider.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="E-mail"
              />
            </div>
          </FormGrid>
        </FormContainer>

        <FormContainer className="mb-6">
          <FormGrid>
            {/* Observaciones */}
            <div>
              <Label>Observaciones</Label>
              <Input
                name="description"
                value={provider.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Observaciones"
              />
            </div>
          </FormGrid>
        </FormContainer>

        {/* Buttons */}
        <div className="flex justify-center gap-10 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/proveedores")}
          >
            Cancelar
          </Button>
          <Button variant="default" type="submit">
            Guardar
          </Button>
        </div>
      </form>
    </Container>
  );
};

export default EditProveedor;
