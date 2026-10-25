"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "@/interfaces/IUser";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCompanyUser,
  CreateCompanyUserRequest,
  updateUser,
  UpdateUserRequest,
} from "@/services/userService";

import { useCompanyRoles } from "@/features/users/useCompanyRoles";

import ubigeos from "@/utils/json/ubigeos.json";

interface UserFormProps {
  user: User | null;
  onUserSaved: () => void;
}

export default function UserForm({ user, onUserSaved }: UserFormProps) {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const roleState = useCompanyRoles();
  const roles = roleState.roles;
  const isSelf = !!user && user.id === auth?.user.id;
  const rolesReady = !roleState.loading && !roleState.error && roleState.access?.canRead === true;

  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    identityDocument: "",
    phoneNumber: "",
    password: "",
    address: "",
    department: "",
    province: "",
    district: "",
    roleName: "",
    status: true,
  });

  // Ubigeo data logic
  const departments = ubigeos[0].departments;
  const filteredProvinces =
    departments.find((d) => d.name === formData.department)?.provinces || [];
  const filteredDistricts =
    filteredProvinces.find((p) => p.name === formData.province)?.districts || [];

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        surname: user.surname || "",
        email: user.email || "",
        identityDocument: user.identityDocument || "",
        phoneNumber: user.phoneNumber || "",
        password: "", // No mostrar contraseña al editar
        address: user.address || "",
        department: user.department || "",
        province: user.province || "",
        district: user.district || "",
        roleName: user.role?.name || "",
        status: user.status ?? true,
      });
    } else {
      // Limpiar formulario para nuevo usuario
      setFormData({
        name: "",
        surname: "",
        email: "",
        identityDocument: "",
        phoneNumber: "",
        password: "",
        address: "",
        department: "",
        province: "",
        district: "",
        roleName: "",
        status: true,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth?.company?.id || !auth.accessToken) {
      toast.error("No se encontró la compañía asociada");
      return;
    }

    if (!rolesReady) {
      toast.error(roleState.error || "Espera a que se carguen los perfiles del negocio.");
      return;
    }
    if (isSelf && formData.roleName !== user?.role?.name) {
      toast.error("No puedes cambiar tu propio rol.");
      return;
    }
    const selectedRole = roles.find((role) => role.assignmentName === formData.roleName);
    const unchangedRole = !!user && formData.roleName === user.role?.name;
    if ((!selectedRole || !selectedRole.assignable) && !unchangedRole) {
      toast.error("Selecciona un perfil disponible de este negocio.");
      return;
    }
    if (!formData.roleName) {
      toast.error("Selecciona un rol para el usuario");
      return;
    }

    if (!user && !formData.password) {
      toast.error("La contraseña es obligatoria para nuevos usuarios");
      return;
    }

    setLoading(true);

    try {
      if (user) {
        // Actualizar usuario existente
        const updateRequest: UpdateUserRequest = {
          name: formData.name,
          surname: formData.surname,
          address: formData.address,
          city: formData.department,
          province: formData.province,
          district: formData.district,
          phoneNumber: formData.phoneNumber,
          ...(!unchangedRole && { roleName: formData.roleName }),
        };

        await updateUser(user.id, updateRequest, auth.accessToken!);
        toast.success("Usuario actualizado exitosamente");
      } else {
        // Crear nuevo usuario
        const request: CreateCompanyUserRequest = {
          identityDocument: formData.identityDocument,
          name: formData.name,
          surname: formData.surname,
          email: formData.email,
          password: formData.password,
          address: formData.address,
          department: formData.department,
          province: formData.province,
          district: formData.district,
          phoneNumber: formData.phoneNumber,
          roleName: formData.roleName,
        };

        await createCompanyUser(auth.company.id, request, auth.accessToken);
        toast.success("Usuario creado exitosamente");
      }
      onUserSaved();
    } catch (error: any) {
      // Extraer mensaje de error específico del backend
      let message = "Error al guardar usuario";

      if (error?.response?.data) {
        const data = error.response.data;
        // Errores de validación de Spring (MethodArgumentNotValidException)
        if (data.errors && Array.isArray(data.errors)) {
          message = data.errors.map((e: any) => e.defaultMessage || e.message).join(". ");
        } else if (data.message) {
          message = data.message;
        } else if (typeof data === "string") {
          message = data;
        }
      } else if (error?.message) {
        message = error.message;
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            placeholder="Ej. Juan"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="surname">Apellido</Label>
          <Input
            id="surname"
            placeholder="Ej. Pérez"
            value={formData.surname}
            onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="juan.perez@ejemplo.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Teléfono</Label>
          <Input
            id="phoneNumber"
            placeholder="912345678"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="identityDocument">Documento de Identidad</Label>
          <Input
            id="identityDocument"
            placeholder="DNI / RUC"
            value={formData.identityDocument}
            onChange={(e) => setFormData({ ...formData, identityDocument: e.target.value })}
            required
          />
        </div>
        {!user ? (
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número.
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rol</Label>
        <select
          id="role"
          value={formData.roleName}
          disabled={!rolesReady || isSelf || loading}
          onChange={(event) => setFormData({ ...formData, roleName: event.target.value })}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">{roleState.loading ? "Cargando perfiles…" : "Seleccionar rol"}</option>
          {user?.role &&
          !roles.some((role) => role.assignmentName === user.role?.name && role.assignable) ? (
            <option value={user.role.name} disabled>
              {roles.find((role) => role.id === user.role?.id)?.name || user.role.name} (actual)
            </option>
          ) : null}
          {roles
            .filter((role) => role.assignable)
            .map((role) => (
              <option key={role.id} value={role.assignmentName}>
                {role.name}
              </option>
            ))}
        </select>
        {isSelf ? (
          <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>
        ) : null}
        {roleState.error || (!roleState.loading && !roleState.access?.canRead) ? (
          <div role="alert" className="text-sm text-red-700">
            <p>{roleState.error || "Tu cuenta no tiene permiso para consultar perfiles."}</p>
            <Button type="button" variant="outline" onClick={() => void roleState.refresh()}>
              Reintentar perfiles
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Departamento</Label>
          <Select
            value={formData.department}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                department: value,
                province: "",
                district: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Provincia</Label>
          <Select
            value={formData.province}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                province: value,
                district: "",
              })
            }
            disabled={!formData.department}
          >
            <SelectTrigger>
              <SelectValue placeholder="Provincia" />
            </SelectTrigger>
            <SelectContent>
              {filteredProvinces.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">Distrito</Label>
          <Select
            value={formData.district}
            onValueChange={(value) => setFormData({ ...formData, district: value })}
            disabled={!formData.province}
          >
            <SelectTrigger>
              <SelectValue placeholder="Distrito" />
            </SelectTrigger>
            <SelectContent>
              {filteredDistricts.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección exacta / Referencia</Label>
        <Input
          id="address"
          placeholder="Av. Las Magnolias 123, frente al parque"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" type="button" onClick={() => onUserSaved()} disabled={loading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700"
          disabled={loading || !rolesReady}
        >
          {loading ? "Guardando..." : user ? "Actualizar Usuario" : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
