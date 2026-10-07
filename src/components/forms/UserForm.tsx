"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useId } from "react";
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
import { isCompanyAssignableRole } from "@/config/userRoles";

import ubigeos from "@/utils/json/ubigeos.json";

interface UserFormProps {
  user: User | null;
  onUserSaved: () => void;
  onCancel: () => void;
  onSavingChange?: (saving: boolean) => void;
}

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*\d).{6,}$/;

const PASSWORD_POLICY_MESSAGE =
  "La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número.";

const SELF_WITHOUT_ROLE_MESSAGE =
  "Tu usuario no tiene un rol asignado y no podés asignártelo vos. No se pueden guardar cambios en tu perfil desde aquí hasta que otro administrador te asigne un rol.";

type RolesStatus = "loading" | "ready" | "empty" | "error" | "unauthenticated";

const ROLES_UNAVAILABLE_MESSAGE: Record<Exclude<RolesStatus, "ready">, string> = {
  loading: "Cargando roles…",
  empty: "No hay roles disponibles para asignar",
  error: "No se pudieron cargar los roles. No se puede guardar sin un rol válido.",
  unauthenticated: "Sesión no disponible. Volvé a iniciar sesión para cargar los roles.",
};

export default function UserForm({
  user,
  onUserSaved,
  onCancel,
  onSavingChange,
}: UserFormProps) {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const onSavingChangeRef = useRef(onSavingChange);
  const rolesRequestRef = useRef(0);
  // Solo roles reales de GET /api/v1/roles — sin respaldo local: un rol
  // inventado (antes ids "1"–"5") terminaba enviándose a ms-auth.
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesStatus, setRolesStatus] = useState<RolesStatus>("loading");

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

  // PUT /api/v1/auth/user/{id} (UpdateUserRequest) no acepta email ni
  // documento: al editar se muestran de solo lectura en vez de aceptar un
  // cambio que se descartaría y reportar "actualizado". Para hacerlos
  // editables, ms-auth tiene que incluirlos en el contrato de edición (O-04).
  const isEditing = !!user;
  const isSelf = !!user && !!auth?.user?.id && user.id === auth.user.id;
  const isSelfWithoutRole = isSelf && !currentRoleName;
  const roleFieldId = useId();
  const roleSelectionDisabled = rolesStatus !== "ready" || isSelf;

  // Ubigeo data logic
  const departments = ubigeos[0].departments;
  const filteredProvinces =
    departments.find((d) => d.name === formData.department)?.provinces || [];
  const filteredDistricts =
    filteredProvinces.find((p) => p.name === formData.province)?.districts ||
    [];

  useLayoutEffect(() => {
    onSavingChangeRef.current = onSavingChange;
  }, [onSavingChange]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savingRef.current) {
        savingRef.current = false;
        onSavingChangeRef.current?.(false);
      }
    };
  }, []);

  // Load roles from API
  const loadRoles = useCallback((accessToken: string) => {
    const requestId = ++rolesRequestRef.current;
    setRolesStatus("loading");
    getRoles(accessToken)
      .then((rolesData) => {
        if (requestId !== rolesRequestRef.current) return;
        // Filtrar solo roles permitidos para usuarios de compañía (no ADMINISTRADOR ni USUARIO)
        const allowedRoles = (Array.isArray(rolesData) ? rolesData : []).filter(
          (r) => isCompanyAssignableRole(r.name),
        );
        setRoles(allowedRoles);
        setRolesStatus(allowedRoles.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (requestId !== rolesRequestRef.current) return;
        setRoles([]);
        setRolesStatus("error");
        toast.error("No se pudieron cargar los roles");
      });
  }, []);

  useEffect(() => {
    const accessToken = auth?.accessToken;
    if (!accessToken) {
      rolesRequestRef.current += 1;
      setRoles([]);
      setRolesStatus("unauthenticated");
      return;
    }
    loadRoles(accessToken);
    return () => {
      rolesRequestRef.current += 1;
    };
  }, [auth?.accessToken, loadRoles]);

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
        department: user.department || user.city || "",
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

  const setSaving = (saving: boolean) => {
    savingRef.current = saving;
    setLoading(saving);
    onSavingChange?.(saving);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (savingRef.current) return;

    const companyId = auth?.company?.id;
    if (!companyId) {
      toast.error("No se encontró la compañía asociada");
      return;
    }

    const accessToken = auth?.accessToken;
    if (!accessToken) {
      toast.error(ROLES_UNAVAILABLE_MESSAGE.unauthenticated);
      return;
    }

    if (rolesStatus !== "ready") {
      toast.error(ROLES_UNAVAILABLE_MESSAGE[rolesStatus]);
      return;
    }

    const fields = {
      name: formData.name.trim(),
      surname: formData.surname.trim(),
      email: formData.email.trim(),
      identityDocument: formData.identityDocument.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      address: formData.address.trim(),
    };

    const missingFields = [
      !fields.name && "Nombre",
      !fields.surname && "Apellido",
      !isEditing && !fields.email && "Correo electrónico",
      !isEditing && !fields.identityDocument && "Documento de Identidad",
    ].filter(Boolean);
    if (missingFields.length > 0) {
      toast.error(`Completá los campos obligatorios: ${missingFields.join(", ")}`);
      return;
    }

    if (isSelfWithoutRole) {
      toast.error(SELF_WITHOUT_ROLE_MESSAGE);
      return;
    }

    if (isSelf && formData.roleName !== currentRoleName) {
      toast.error("No podés cambiar tu propio rol");
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

    if (formData.password && !PASSWORD_POLICY.test(formData.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setSaving(true);

    try {
      if (user) {
        // Actualizar usuario existente
        const updateRequest: UpdateUserRequest = {
          name: fields.name,
          surname: fields.surname,
          address: fields.address,
          ...(formData.department && { city: formData.department }),
          province: formData.province,
          district: formData.district,
          phoneNumber: fields.phoneNumber,
          roleName: formData.roleName,
          // Solo enviar password si se ingresó uno nuevo
          ...(formData.password && { password: formData.password }),
        };

        await updateUser(user.id, updateRequest, accessToken);
        toast.success("Usuario actualizado exitosamente");
      } else {
        // Crear nuevo usuario
        const request: CreateCompanyUserRequest = {
          identityDocument: fields.identityDocument,
          name: fields.name,
          surname: fields.surname,
          email: fields.email,
          password: formData.password,
          address: fields.address,
          department: formData.department,
          province: formData.province,
          district: formData.district,
          phoneNumber: fields.phoneNumber,
          roleName: formData.roleName,
        };

        await createCompanyUser(companyId, request, accessToken);
        toast.success("Usuario creado exitosamente");
      }
      if (!mountedRef.current) return;
      setSaving(false);
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
      if (mountedRef.current) setSaving(false);
    }
  };

  const renderRoleOption = (
    option: { value: string; label: string; description?: string },
    index: number,
    disabled: boolean,
  ) => {
    const optionId = `${roleFieldId}-option-${index}`;
    const descriptionId = option.description ? `${optionId}-description` : undefined;
    return (
      <div
        key={option.value}
        className="relative flex items-start gap-3 rounded-lg border p-3 transition-colors has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 dark:has-[:checked]:bg-teal-500/10"
      >
        <input
          id={optionId}
          type="radio"
          name={`${roleFieldId}-role`}
          value={option.value}
          checked={formData.roleName === option.value}
          onChange={() => setFormData({ ...formData, roleName: option.value })}
          disabled={disabled}
          aria-describedby={descriptionId}
          className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
        />
        <div className="min-w-0">
          <label
            htmlFor={optionId}
            className="cursor-pointer text-sm font-medium break-words after:absolute after:inset-0 after:content-['']"
          >
            {option.label}
          </label>
          {option.description && (
            <p id={descriptionId} className="text-xs text-muted-foreground">
              {option.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-2">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section aria-labelledby={`${roleFieldId}-personal`} className="space-y-4">
          <h3
            id={`${roleFieldId}-personal`}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Datos personales
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                disabled={isEditing}
                aria-describedby={isEditing ? "readonly-fields-hint" : undefined}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                disabled={isEditing}
                aria-describedby={isEditing ? "readonly-fields-hint" : undefined}
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
                autoComplete="new-password"
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

          {isEditing && (
            <p id="readonly-fields-hint" className="text-xs text-muted-foreground">
              El correo y el documento no se pueden modificar desde aquí.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <fieldset
            disabled={roleSelectionDisabled}
            aria-describedby={isSelf ? "own-role-hint" : undefined}
            className="space-y-3"
          >
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rol
            </legend>
            {rolesStatus === "loading" && (
              <p role="status" className="text-xs text-muted-foreground">
                {ROLES_UNAVAILABLE_MESSAGE.loading}
              </p>
            )}
            {rolesStatus === "ready" && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {!isCurrentRoleAssignable &&
                  renderRoleOption(
                    {
                      value: currentRoleName,
                      label: `${currentRoleName} (actual, no asignable)`,
                    },
                    0,
                    true,
                  )}
                {roles.map((role, index) =>
                  renderRoleOption(
                    {
                      value: role.name,
                      label: role.name,
                      description: role.description?.trim() || undefined,
                    },
                    index + 1,
                    false,
                  ),
                )}
              </div>
            )}
          </fieldset>
          {isSelf && !isSelfWithoutRole && (
            <p id="own-role-hint" className="text-xs text-muted-foreground">
              No podés cambiar tu propio rol.
            </p>
          )}
          {isSelfWithoutRole && (
            <p
              id="own-role-hint"
              role="status"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
            >
              {SELF_WITHOUT_ROLE_MESSAGE}
            </p>
          )}
          {rolesStatus === "unauthenticated" && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {ROLES_UNAVAILABLE_MESSAGE.unauthenticated}
            </div>
          )}
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
                onClick={() => {
                  if (auth?.accessToken) loadRoles(auth.accessToken);
                }}
              >
                Reintentar
              </Button>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby={`${roleFieldId}-address`} className="space-y-4">
        <h3
          id={`${roleFieldId}-address`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Ubicación
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t bg-background px-6 py-4">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700"
          disabled={loading || rolesStatus !== "ready" || isSelfWithoutRole}
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
