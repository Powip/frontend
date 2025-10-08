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
  useDisableClient,
} from "@/src/hooks/useCreateClient";
import { AxiosError } from "axios";
import { IClient } from "@/src/api/Interfaces";

type Props = {
  next: () => void;
};

export const FichaCliente = ({ next }: Props) => {
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    nickName: "",
    phoneNumber: "",
    clientType: "L",
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
  const disableClientMutation = useDisableClient();

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
        clientType: c.clientType || "",
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
      name: "",
      lastName: "",
      nickName: "",
      phoneNumber: "",
      clientType: "",
      address: "",
      province: "",
      city: "",
      district: "",
      reference: "",
    });
    setCurrentClientId(null);
  };

  const handleDisable = () => {
    if (!currentClientId) {
      alert("No hay cliente para desactivar");
      return;
    }

    disableClientMutation.mutate(currentClientId, {
      onSuccess: () => {
        alert("Cliente desactivado con éxito");
        resetForm();
      },
      onError: handleError,
    });
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
            <Button
              onClick={handleDisable}
              disabled={disableClientMutation.isPending || !currentClientId}
            >
              <Trash />
              {disableClientMutation.isPending ? "Eliminando..." : "Eliminar"}
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
                <SelectItem value="MAYORISTA">Mayorista</SelectItem>
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
