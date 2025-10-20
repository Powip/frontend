"use client";

import { useState, useEffect } from "react";
import { Edit, Save, Trash } from "lucide-react";
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
  useDeleteClient,
} from "@/src/hooks/useCreateClient";
import { AxiosError } from "axios";
import { IClient } from "@/src/api/Interfaces";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

type Props = {
  next: (id: string) => void;
};

export const Clientes = ({ next }: Props) => {
  const [form, setForm] = useState({
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
  const [isEditable, setIsEditable] = useState(true);
  const [isEditConfirmOpen, setIsEditConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();
  const { data: clientByPhone, isLoading: isClientLoading } =
    useClientByPhone(searchPhone);

  const companyId = "5d5b824c-2b81-4b17-960f-855bfc7806e2";

  useEffect(() => {
    if (isClientLoading) return;

    if (clientByPhone) {
      const c: IClient = clientByPhone;
      setCurrentClientId(c.id);
      setIsEditable(false);
      next(c.id);

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

      setHasSearched(false);
    } else if (searchPhone && !hasSearched) {
      toast.error(
        `Cliente con número ${searchPhone} no existe. Por favor, complete los datos para crearlo.`
      );
      resetForm(searchPhone);
      setCurrentClientId(null);
      setIsEditable(true);
      setHasSearched(true);
    }
  }, [clientByPhone, isClientLoading, searchPhone, hasSearched, next]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleError = (err: unknown) => {
    if (err instanceof AxiosError) {
      toast.error(err.response?.data?.message || "Error en la operación");
    } else if (err instanceof Error) {
      toast.error(err.message);
    } else {
      toast.error("Error desconocido");
    }
  };

  const handleSaveClient = (isNew: boolean) => {
    if (!form.name || !form.phoneNumber) {
      toast.error("El nombre y teléfono son obligatorios.");
      return;
    }

    const payload = { ...form };

    if (isNew) {
      payload.companyId = companyId;
      createClientMutation.mutate(payload, {
        onSuccess: (response) => {
          const newClientId = response.clientData.id;
          setCurrentClientId(newClientId);
          setIsEditable(false);
          next(newClientId);
          toast.success(response.message || "Cliente creado con éxito");
        },
        onError: handleError,
      });
    } else {
      if (!currentClientId) return toast.error("No hay cliente para actualizar");

      updateClientMutation.mutate(
        { id: currentClientId, client: payload },
        {
          onSuccess: () => {
            toast.success("Cliente actualizado con éxito");
            setIsEditable(false);
            next(currentClientId);
          },
          onError: handleError,
        }
      );
    }
  };

  const handleDelete = () => {
    if (!currentClientId) return toast.error("No hay cliente para eliminar");

    deleteClientMutation.mutate(currentClientId, {
      onSuccess: () => {
        toast.success("Cliente eliminado con éxito");
        resetForm("");
        setIsEditable(true);
        setHasSearched(false);
        setIsDeleteConfirmOpen(false);
      },
      onError: handleError,
    });
  };

  const handleEditClick = () => {
    if (!currentClientId) return;
    if (isEditable) handleSaveClient(false);
    else setIsEditConfirmOpen(true);
  };

  const confirmEdit = () => {
    setIsEditable(true);
    setIsEditConfirmOpen(false);
    toast.info("Modo de edición activado. No olvide Guardar Cambios.");
  };

  const resetForm = (phoneNumberToKeep = "") => {
    setForm({
      name: "",
      lastName: "",
      nickName: "",
      phoneNumber: phoneNumberToKeep,
      clientType: "TRADICIONAL",
      address: "",
      province: "",
      city: "",
      district: "",
      reference: "",
    });
    setCurrentClientId(null);
  };

  const isSaving =
    createClientMutation.isPending || updateClientMutation.isPending;
  const inputClassName = !isEditable ? "bg-gray-100 cursor-not-allowed" : "";
  const isDisabled = !isEditable;

  return (
    <Container>
      <Header>Cliente</Header>

      <FormContainer className="border-none">
        <FormGrid>
          <div>
            <Label>Nro Telefono (Búsqueda)</Label>
            <Input
              type="number"
              value={form.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && form.phoneNumber.length >= 6)
                  setSearchPhone(form.phoneNumber);
              }}
              disabled={isClientLoading || isSaving}
              placeholder="Ingrese número y presione Enter"
            />
          </div>
        </FormGrid>
      </FormContainer>

      <FormContainer>
        <FormGrid>
          <div>
            <Label>Nombre*</Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
          <div>
            <Label>Apellido*</Label>
            <Input
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
          <div>
            <Label>Nickname*</Label>
            <Input
              value={form.nickName}
              onChange={(e) => handleChange("nickName", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Teléfono*</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
          <div>
            <Label>Tipo de Cliente*</Label>
            <Select
              onValueChange={(value) => handleChange("clientType", value)}
              value={form.clientType}
              disabled={isDisabled}
            >
              <SelectTrigger className={`w-full ${inputClassName}`}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRADICIONAL">Tradicional</SelectItem>
                <SelectItem value="MAYORISTA">Mayorista</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Dirección*</Label>
            <Input
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Provincia*</Label>
            <Input
              value={form.province}
              onChange={(e) => handleChange("province", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
          <div>
            <Label>Ciudad*</Label>
            <Input
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
          <div>
            <Label>Distrito*</Label>
            <Input
              value={form.district}
              onChange={(e) => handleChange("district", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
        </FormGrid>

        <FormGrid>
          <div>
            <Label>Referencia</Label>
            <Textarea
              value={form.reference}
              onChange={(e) => handleChange("reference", e.target.value)}
              disabled={isDisabled}
              className={inputClassName}
            />
          </div>
        </FormGrid>
      </FormContainer>

      <FormGrid>
        {currentClientId ? (
          <div className="w-full flex justify-between">
            <Button
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={isSaving}
              variant="outline"
              className="border-red text-red"
            >
              <Trash className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
            <Button onClick={handleEditClick} disabled={isSaving}>
              {isEditable ? (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Modificar
                </>
              )}
            </Button>
          </div>
        ) : (
          isEditable && (
            <Button
              onClick={() => handleSaveClient(true)}
              disabled={isSaving || form.phoneNumber.length === 0}
              variant="lime"
              className="w-full max-w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar Nuevo Cliente"}
            </Button>
          )
        )}
      </FormGrid>

      <Dialog open={isEditConfirmOpen} onOpenChange={setIsEditConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Edición de Cliente</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {`¿Está seguro que desea habilitar la edición para el cliente ${form.name} ${form.lastName}? Al confirmar, podrá cambiar todos los campos y deberá presionar 'Guardar Cambios' al finalizar.`}
          </DialogDescription>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsEditConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmEdit}>Confirmar Edición</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {`¡ATENCIÓN! ¿Está seguro que desea eliminar al cliente ${form.name} ${form.lastName}? Esta acción es irreversible.`}
          </DialogDescription>
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              className="border-red text-red"
              onClick={handleDelete}
              disabled={deleteClientMutation.isPending}
            >
              {deleteClientMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
            <Button variant="blue" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
};
