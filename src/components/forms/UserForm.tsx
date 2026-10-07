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
import { ChevronDown } from "lucide-react";
import { PermissionMatrix } from "@/components/users/PermissionMatrix";
import { PendingBackendNotice } from "@/components/users/PendingBackendNotice";
import { roleStyle, usersTheme } from "@/components/users/usersTheme";

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
  const [showPermissions, setShowPermissions] = useState(false);
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
      !fields.surname && "Apellidos",
      !isEditing && !fields.email && "Email",
      !isEditing && !fields.identityDocument && "DNI / Documento",
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

  const selectedRoleDescription = roles.find((role) => role.name === formData.roleName)?.description?.trim();

  const renderRoleOption = (
    option: { value: string; label: string; description?: string },
    index: number,
    disabled: boolean,
  ) => {
    const optionId = `${roleFieldId}-option-${index}`;
    const descriptionId = option.description ? `${optionId}-description` : undefined;
    const style = roleStyle(option.value);
    return (
      <div key={option.value} className={usersTheme.selectableCard}>
        <input
          id={optionId}
          type="radio"
          name={`${roleFieldId}-role`}
          value={option.value}
          checked={formData.roleName === option.value}
          onChange={() => setFormData({ ...formData, roleName: option.value })}
          disabled={disabled}
          aria-describedby={descriptionId}
          className="sr-only"
        />
        <span aria-hidden="true" className="mb-1 block text-lg">
          {style.icon}
        </span>
        <label
          htmlFor={optionId}
          className="block cursor-pointer break-words text-xs font-semibold text-[#0e0b1f] after:absolute after:inset-0 after:content-[''] dark:text-foreground"
        >
          {option.label}
        </label>
        {option.description && (
          <p id={descriptionId} className="mt-0.5 text-[10px] text-[#8b87a3]">
            {option.description}
          </p>
        )}
      </div>
    );
  };

  const fieldLabel = (htmlFor: string, text: React.ReactNode, required = false) => (
    <Label
      htmlFor={htmlFor}
      className={`${usersTheme.fieldLabel} ${required ? usersTheme.requiredMark : ""}`}
    >
      {text}
    </Label>
  );

  const nameFields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        {fieldLabel("name", "Nombre", true)}
        <Input
          id="name"
          placeholder="Nombre"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className={usersTheme.input}
        />
      </div>
      <div className="space-y-1">
        {fieldLabel("surname", "Apellidos", true)}
        <Input
          id="surname"
          placeholder="Apellidos"
          value={formData.surname}
          onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
          required
          className={usersTheme.input}
        />
      </div>
    </div>
  );

  const emailField = (
    <div className="space-y-1">
      {fieldLabel("email", "Email", !isEditing)}
      <Input
        id="email"
        type="email"
        placeholder="colaborador@empresa.com"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
        disabled={isEditing}
        aria-describedby={isEditing ? "readonly-fields-hint" : undefined}
        className={usersTheme.input}
      />
    </div>
  );

  const phoneField = (
    <div className="space-y-1">
      {fieldLabel("phoneNumber", "Teléfono")}
      <div className="flex overflow-hidden rounded-[9px] border-[1.5px] border-[#e8e4f8] focus-within:border-[#4C2FB5] dark:border-border">
        <span
          aria-hidden="true"
          className="border-r border-[#e8e4f8] bg-[#f7f6ff] px-[11px] py-2 text-xs text-[#8b87a3] dark:border-border dark:bg-muted"
        >
          +51
        </span>
        <Input
          id="phoneNumber"
          inputMode="tel"
          placeholder="987 654 321"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          className="rounded-none border-0 text-[13px] shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );

  const documentField = (
    <div className="space-y-1">
      {fieldLabel("identityDocument", "DNI / Documento", !isEditing)}
      <Input
        id="identityDocument"
        placeholder="12345678"
        value={formData.identityDocument}
        onChange={(e) => setFormData({ ...formData, identityDocument: e.target.value })}
        required
        disabled={isEditing}
        aria-describedby={isEditing ? "readonly-fields-hint" : undefined}
        className={usersTheme.input}
      />
    </div>
  );

  const passwordField = (
    <div className="space-y-1">
      <Label htmlFor="password" className={`${usersTheme.fieldLabel} ${user ? "" : usersTheme.requiredMark}`}>
        Contraseña{" "}
        {user && (
          <span className="text-[10px] font-normal normal-case tracking-normal text-[#8b87a3]">
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
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required={!user}
        className={usersTheme.input}
      />
      <p className="text-[10px] text-[#8b87a3]">
        Al menos 6 caracteres, una letra minúscula y un número.
      </p>
    </div>
  );

  const addressFields = (
    <div className="space-y-3">
      <div className="space-y-1">
        {fieldLabel("address", "Dirección")}
        <Input
          id="address"
          placeholder="Jr. Iquique 807"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className={usersTheme.input}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          {fieldLabel("department", "Departamento")}
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
            <SelectTrigger className={usersTheme.input}>
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
        <div className="space-y-1">
          {fieldLabel("province", "Provincia")}
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
            <SelectTrigger className={usersTheme.input}>
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
        <div className="space-y-1">
          {fieldLabel("district", "Distrito")}
          <Select
            value={formData.district}
            onValueChange={(value) => setFormData({ ...formData, district: value })}
            disabled={!formData.province}
          >
            <SelectTrigger className={usersTheme.input}>
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
    </div>
  );

  const roleSection = (compact: boolean) => (
    <div className="space-y-3">
      {compact ? (
        <div className="space-y-1">
          <Label htmlFor={`${roleFieldId}-role`} className={usersTheme.fieldLabel}>
            Rol
          </Label>
          <select
            id={`${roleFieldId}-role`}
            value={formData.roleName}
            onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
            disabled={roleSelectionDisabled}
            aria-describedby={isSelf ? "own-role-hint" : undefined}
            className={`h-9 w-full bg-white px-3 dark:bg-transparent ${usersTheme.input}`}
          >
            <option value="">
              {rolesStatus === "ready" ? "Seleccionar rol" : ROLES_UNAVAILABLE_MESSAGE[rolesStatus]}
            </option>
            {rolesStatus === "ready" && !isCurrentRoleAssignable && (
              <option value={currentRoleName} disabled>
                {currentRoleName} (actual, no asignable)
              </option>
            )}
            {rolesStatus === "ready" &&
              roles.map((role) => (
                <option key={role.id || role.name} value={role.name}>
                  {role.name}
                </option>
              ))}
          </select>
        </div>
      ) : (
      <fieldset
        disabled={roleSelectionDisabled}
        aria-describedby={isSelf ? "own-role-hint" : undefined}
        className="space-y-2"
      >
        <legend className="sr-only">Rol</legend>
        {rolesStatus === "loading" && (
          <p role="status" className="text-xs text-[#8b87a3]">
            {ROLES_UNAVAILABLE_MESSAGE.loading}
          </p>
        )}
        {rolesStatus === "ready" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            <button
                type="button"
                disabled
                aria-describedby={`${roleFieldId}-custom-pending`}
                className="rounded-[9px] border-2 border-dashed border-[#e8e4f8] bg-white p-3 text-center opacity-70 disabled:cursor-not-allowed dark:bg-transparent"
              >
                <span aria-hidden="true" className="mb-1 block text-lg">
                  ⚙️
                </span>
                <span className="block text-xs font-semibold">Personalizado</span>
                <span id={`${roleFieldId}-custom-pending`} className="mt-0.5 block text-[10px] text-[#8b87a3]">
                  Próximamente
                </span>
              </button>
          </div>
        )}
      </fieldset>
      )}
      {!compact && selectedRoleDescription && (
        <p className="rounded-lg bg-[#f7f6ff] px-[11px] py-2 text-[11px] text-[#8b87a3] dark:bg-muted">
          {selectedRoleDescription}
        </p>
      )}
      {isSelf && !isSelfWithoutRole && (
        <p id="own-role-hint" className="text-xs text-[#8b87a3]">
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
    </div>
  );

  const readonlyHint = isEditing && (
    <p id="readonly-fields-hint" className="text-xs text-[#8b87a3]">
      El correo y el documento no se pueden modificar desde aquí.
    </p>
  );

  const footer = (
    <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-[#e8e4f8] bg-background px-6 py-3.5 dark:border-border">
      <button type="button" className={usersTheme.secondaryButton} onClick={onCancel} disabled={loading}>
        Cancelar
      </button>
      <button
        type="submit"
        className={usersTheme.primaryButton}
        disabled={loading || rolesStatus !== "ready" || isSelfWithoutRole}
      >
        {loading ? "Guardando..." : user ? "Guardar cambios" : "Crear usuario"}
      </button>
    </div>
  );

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3 py-1">
        {nameFields}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {emailField}
          {phoneField}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roleSection(true)}
          <div className="space-y-1">
            <Label htmlFor={`${roleFieldId}-status`} className={usersTheme.fieldLabel}>
              Estado
            </Label>
            <select
              id={`${roleFieldId}-status`}
              value={formData.status ? "active" : "inactive"}
              disabled
              aria-describedby={`${roleFieldId}-status-pending`}
              className={`h-9 w-full bg-white px-3 dark:bg-transparent ${usersTheme.input}`}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <p id={`${roleFieldId}-status-pending`} className="text-[10px] text-[#8b87a3]">
              El estado todavía no se puede cambiar desde aquí.
            </p>
          </div>
        </div>
        <p className="rounded-[9px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2.5 text-xs text-[#c2410c]">
          ⚠️ Cambiar el rol modifica los accesos del colaborador. Todavía no está definido en qué momento el cambio se
          aplica si tiene una sesión abierta.
        </p>
        {readonlyHint}
        <details className="group rounded-[9px] border border-[#e8e4f8] px-3 py-2 dark:border-border">
          <summary className="cursor-pointer text-xs font-semibold text-[#2D2A45] dark:text-foreground">
            Más datos del colaborador
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {documentField}
              {passwordField}
            </div>
            {addressFields}
          </div>
        </details>
        {footer}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="py-1">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <section aria-labelledby={`${roleFieldId}-personal`} className="space-y-3">
          <h3 id={`${roleFieldId}-personal`} className={usersTheme.sectionTitle}>
            Datos personales
          </h3>
          {nameFields}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label
                htmlFor={`${roleFieldId}-login`}
                className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}
              >
                Usuario / login
              </Label>
              <Input
                id={`${roleFieldId}-login`}
                placeholder="ej: cmejia"
                disabled
                aria-describedby={`${roleFieldId}-identity-pending`}
                className={usersTheme.input}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${roleFieldId}-gender`} className={usersTheme.fieldLabel}>
                Género
              </Label>
              <select
                id={`${roleFieldId}-gender`}
                disabled
                aria-describedby={`${roleFieldId}-identity-pending`}
                className={`h-9 w-full bg-white px-3 dark:bg-transparent ${usersTheme.input}`}
              >
                <option value="">Selecciona</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <p id={`${roleFieldId}-identity-pending`} className="text-[10px] text-[#8b87a3]">
            Usuario/login y género todavía no están disponibles: hoy el colaborador ingresa con su email y estos datos
            no se guardan.
          </p>
          {emailField}
          {phoneField}
          <h3 className={`${usersTheme.sectionTitle} pt-2`}>Dirección</h3>
          {addressFields}
          {documentField}
          <h3 className={`${usersTheme.sectionTitle} pt-2`}>Contraseña</h3>
          {passwordField}
          <PendingBackendNotice title="Cambio obligatorio al primer ingreso no disponible">
            La contraseña que definas es la definitiva hasta que esta opción esté disponible.
          </PendingBackendNotice>
        </section>
        <section aria-labelledby={`${roleFieldId}-access`} className="space-y-3">
          <h3 id={`${roleFieldId}-access`} className={usersTheme.sectionTitle}>
            Rol y accesos
          </h3>
          {roleSection(false)}
          <button
            type="button"
            aria-expanded={showPermissions}
            aria-controls={`${roleFieldId}-permissions`}
            onClick={() => setShowPermissions((value) => !value)}
            className="flex w-full items-center gap-2 rounded-[9px] border border-[#ddd6fe] bg-[#f0eeff] px-[13px] py-2.5 text-left text-[13px] font-semibold text-[#4C2FB5]"
          >
            <span className="flex-1">Personalizar permisos por módulo y ruta</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform ${showPermissions ? "rotate-180" : ""}`}
            />
          </button>
          {showPermissions && (
            <div id={`${roleFieldId}-permissions`}>
              <PermissionMatrix caption="Permisos específicos del usuario" />
            </div>
          )}
        </section>
      </div>
      {footer}
    </form>
  );
}
