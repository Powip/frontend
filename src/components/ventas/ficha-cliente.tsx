"use client";

import { useState, useEffect } from "react";
import { Edit, PlusCircleIcon, Trash } from "lucide-react";
import { Button } from "../ui/button";
import Container from "../ui/container";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Header from "../ui/header";
import { Input } from "../ui/input";
import Label from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import {
  useCreateClient,
  useClientByPhone,
  useUpdateClient,
} from "@/src/hooks/useCreateClient";
import { AxiosError } from "axios";
import { IClient } from "@/src/api/Interfaces";

type Props = {
  next: () => void;
};

export const FichaCliente = ({ next }: Props) => {
  const [form, setForm] = useState({
    companyId: "a1b2c3d4-e5f6-7890-abcd-1234567890ef",
    name: "",
    lastName: "",
    nickName: "",
    phoneNumber: "",
    clientType: "TRADICIONAL",
    address: "",
    province: "",
    city: "",
    district: "",
    reference: "",
  });

  const [currentClientId, setCurrentClientId] = useState<string | null>(null);

  // =============================
  // Queries y Mutations
  // =============================
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const { data: clientByPhone } = useClientByPhone(form.phoneNumber);

  // =============================
  // Sincronizar cliente encontrado
  // =============================
  useEffect(() => {
    if (clientByPhone) {
      const c: IClient = clientByPhone;
      setCurrentClientId(c.id); // guardamos el id para actualizar
      setForm((prev) => ({
        ...prev,
        name: c.name || "",
        lastName: c.lastName || "",
        nickName: c.nickName || "",
        phoneNumber: c.phoneNumber || prev.phoneNumber,
        clientType: c.clientType || "TRADICIONAL",
        address: c.address || "",
        province: c.province || "",
        city: c.city || "",
        district: c.district || "",
        reference: c.reference || "",
      }));
    } else {
      setCurrentClientId(null); // si no existe, limpiamos
    }
  }, [clientByPhone]);

  // =============================
  // Handlers
  // =============================
  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    createClientMutation.mutate(form, {
      onSuccess: () => {
        alert("Cliente creado con éxito");
        resetForm();
      },
      onError: handleError,
    });
  };

  const handleUpdate = () => {
    if (!currentClientId) {
      alert("No hay cliente para actualizar");
      return;
    }

    updateClientMutation.mutate(
      { id: currentClientId, client: form },
      {
        onSuccess: () => {
          alert("Cliente actualizado con éxito");
        },
        onError: handleError,
      }
    );
  };

  const handleError = (err: unknown) => {
    if (err instanceof AxiosError) {
      alert(err.response?.data?.message || "Error en la operación");
    } else if (err instanceof Error) {
      alert(err.message);
    } else {
      alert("Error desconocido");
    }
  };

  const resetForm = () => {
    setForm({
      companyId: "a1b2c3d4-e5f6-7890-abcd-1234567890ef",
      name: "",
      lastName: "",
      nickName: "",
      phoneNumber: "",
      clientType: "TRADICIONAL",
      address: "",
      province: "",
      city: "",
      district: "",
      reference: "",
    });
    setCurrentClientId(null);
  };

  // =============================
  // Render
  // =============================
  return (
    <Container>
      <Header>Cliente</Header>
      <FormContainer className="border-none">
        <FormGrid>
          <div>
            <Label>Nro Telefono</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
            />
          </div>
          <div className="flex justify-end self-end gap-3">
            <Button
              onClick={handleCreate}
              disabled={createClientMutation.isPending}
            >
              <PlusCircleIcon />
              {createClientMutation.isPending ? "Guardando..." : "Nuevo"}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateClientMutation.isPending || !currentClientId}
            >
              <Edit />
              {updateClientMutation.isPending ? "Actualizando..." : "Modificar"}
            </Button>
            <Button>
              <Trash />
              Eliminar
            </Button>
          </div>
        </FormGrid>
      </FormContainer>

      {/* resto del formulario igual */}
      <FormContainer>
        <FormGrid>
          <div>
            <Label>Nombre*</Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>
          <div>
            <Label>Apellido*</Label>
            <Input
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
            />
          </div>
          <div>
            <Label>Nickname*</Label>
            <Input
              value={form.nickName}
              onChange={(e) => handleChange("nickName", e.target.value)}
            />
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Teléfono*</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
            />
          </div>
          <div>
            <Label>Tipo de Cliente*</Label>
            <Select
              onValueChange={(value) => handleChange("clientType", value)}
              value={form.clientType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRADICIONAL">Tradicional</SelectItem>
                <SelectItem value="EMPRESA">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormContainer>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Dirección*</Label>
            <Input
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Provincia*</Label>
            <Input
              value={form.province}
              onChange={(e) => handleChange("province", e.target.value)}
            />
          </div>
          <div>
            <Label>Ciudad*</Label>
            <Input
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
            />
          </div>
          <div>
            <Label>Distrito*</Label>
            <Input
              value={form.district}
              onChange={(e) => handleChange("district", e.target.value)}
            />
          </div>
        </FormGrid>
        <FormGrid>
          <div>
            <Label>Referencia</Label>
            <Textarea
              value={form.reference}
              onChange={(e) => handleChange("reference", e.target.value)}
            />
          </div>
        </FormGrid>
      </FormContainer>

      <div>
        <Button className="w-full" onClick={next}>
          Siguiente
        </Button>
      </div>
    </Container>
  );
};
