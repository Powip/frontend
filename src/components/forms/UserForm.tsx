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
import { User, Role } from "@/interfaces/IUser";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCompanyUser,
  getRoles,
  CreateCompanyUserRequest,
  updateUser,
  UpdateUserRequest,
} from "@/services/userService";

import ubigeos from "@/utils/json/ubigeos.json";

interface UserFormProps {
  user: User | null;
  onUserSaved: () => void;
}

/** Roles asignables a colaboradores de una empresa (no ADMINISTRADOR ni USUARIO). */
const COMPANY_USER_ROLES = ["AGENTES", "VENTAS", "OPERACIONES", "COURIER", "CALLER"];

type RolesStatus = "loading" | "ready" | "empty" | "error";

const ROLES_UNAVAILABLE_MESSAGE: Record<Exclude<RolesStatus, "ready">, string> = {
  loading: "Cargando roles…",
  empty: "No hay roles disponibles para asignar",
  error: "No se pudieron cargar los roles. No se puede guardar sin un rol válido.",
};

export default function UserForm({ user, onUserSaved }: UserFormProps) {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  // Solo roles reales de GET /api/v1/roles — sin respaldo local: un rol
  // inventado (antes ids "1"–"5") terminaba enviándose a ms-auth.
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesStatus, setRolesStatus] = useState<RolesStatus>("loading");
  const [rolesReloadKey, setRolesReloadKey] = useState(0);

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

  // Rol actual del usuario cuando no es uno de los asignables (p.ej.
  // ADMINISTRADOR/USUARIO, o un rol que la API ya no devuelve). Se conserva
  // explícito en el selector para no mostrarlo vacío/ambiguo, pero no se
  // puede reasignar: queda deshabilitado en la lista.
  const currentRoleName = user?.role?.name || "";
  const isCurrentRoleAssignable =
    !currentRoleName || roles.some((r) => r.name === currentRoleName);

  // Ubigeo data logic
  const departments = ubigeos[0].departments;
  const filteredProvinces =
    departments.find((d) => d.name === formData.department)?.provinces || [];
  const filteredDistricts =
    filteredProvinces.find((p) => p.name === formData.province)?.districts ||
    [];

  // Load roles from API
  useEffect(() => {
    if (!auth?.accessToken) return;
    let cancelled = false;
    setRolesStatus("loading");
    getRoles(auth.accessToken)
      .then((rolesData) => {
        if (cancelled) return;
        // Filtrar solo roles permitidos para usuarios de compañía (no ADMINISTRADOR ni USUARIO)
        const allowedRoles = (Array.isArray(rolesData) ? rolesData : []).filter(
          (r) => COMPANY_USER_ROLES.includes(r.name?.toUpperCase()),
        );
        setRoles(allowedRoles);
        setRolesStatus(allowedRoles.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (cancelled) return;
        setRoles([]);
        setRolesStatus("error");
        toast.error("No se pudieron cargar los roles");
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.accessToken, rolesReloadKey]);

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

    if (!auth?.company?.id) {
      toast.error("No se encontró la compañía asociada");
      return;
    }

    if (rolesStatus !== "ready") {
      toast.error(ROLES_UNAVAILABLE_MESSAGE[rolesStatus]);
      return;
    }

    if (!formData.roleName) {
      toast.error("Selecciona un rol para el usuario");
      return;
    }

    // Solo se envían roles que vinieron de la API (o, al editar, el rol que
    // el usuario ya tiene asignado).
    const isKnownRole =
      roles.some((r) => r.name === formData.roleName) ||
      (!!user && user.role?.name === formData.roleName);
    if (!isKnownRole) {
      toast.error("El rol seleccionado no es válido");
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
          roleName: formData.roleName,
          // Solo enviar password si se ingresó uno nuevo
          ...(formData.password && { password: formData.password }),
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
          message = data.errors
            .map((e: any) => e.defaultMessage || e.message)
            .join(". ");
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
            onChange={(e) =>
              setFormData({ ...formData, surname: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Teléfono</Label>
          <Input
            id="phoneNumber"
            placeholder="912345678"
            value={formData.phoneNumber}
            onChange={(e) =>
              setFormData({ ...formData, phoneNumber: e.target.value })
            }
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
            onChange={(e) =>
              setFormData({ ...formData, identityDocument: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">
            Contraseña{" "}
            {user && (
              <span className="text-muted-foreground text-xs">
                (dejar vacío para mantener)
              </span>
            )}
          </Label>
          <Input
            id="password"
            type="password"
            placeholder={user ? "••••••••" : "Mínimo 6 caracteres"}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required={!user}
          />
          {!user && (
            <p className="text-[10px] text-muted-foreground mt-1">
              La contraseña debe tener al menos 6 caracteres, una letra
              minúscula y un número.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rol</Label>
        <Select
          value={formData.roleName}
          onValueChange={(value) =>
            setFormData({ ...formData, roleName: value })
          }
          disabled={rolesStatus !== "ready"}
        >
          <SelectTrigger id="role">
            <SelectValue
              placeholder={
                rolesStatus === "ready"
                  ? "Seleccionar rol"
                  : ROLES_UNAVAILABLE_MESSAGE[rolesStatus]
              }
            />
          </SelectTrigger>
          <SelectContent>
            {!isCurrentRoleAssignable && (
              <SelectItem value={currentRoleName} disabled>
                {currentRoleName} (actual, no asignable)
              </SelectItem>
            )}
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.name}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(rolesStatus === "error" || rolesStatus === "empty") && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            <span>{ROLES_UNAVAILABLE_MESSAGE[rolesStatus]}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRolesReloadKey((k) => k + 1)}
            >
              Reintentar
            </Button>
          </div>
        )}
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
            onValueChange={(value) =>
              setFormData({ ...formData, district: value })
            }
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
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          variant="outline"
          type="button"
          onClick={() => onUserSaved()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700"
          disabled={loading || rolesStatus !== "ready"}
        >
          {loading
            ? "Guardando..."
            : user
              ? "Actualizar Usuario"
              : "Crear Usuario"}
        </Button>
      </div>
    </form>
  );
}
