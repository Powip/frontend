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
import { ChevronDown, Eye, EyeOff, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionMatrix } from "@/components/users/PermissionMatrix";
import { UsersNotice } from "@/components/users/PendingBackendNotice";
import { UsersDialogBody, UsersDialogFooter } from "@/components/users/UsersModalShell";
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

const REQUIRED_FIELD_MESSAGE = "Completá este campo.";

const INVALID_EMAIL_MESSAGE = "Ingresá un email válido.";

const ROLE_REQUIRED_MESSAGE = "Elegí un rol para el usuario.";

const PASSWORD_REQUIRED_MESSAGE = "La contraseña es obligatoria para nuevos usuarios.";

type FieldKey = "name" | "surname" | "email" | "identityDocument" | "password" | "role";

type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = ["name", "surname", "email", "identityDocument", "role", "password"];

const MORE_TAB_FIELDS: FieldKey[] = ["identityDocument", "password"];

type EditTab = "main" | "more";

const isValidEmail = (value: string) => {
  const input = document.createElement("input");
  input.type = "email";
  input.value = value;
  return input.checkValidity();
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pendingFocus, setPendingFocus] = useState<FieldKey | null>(null);
  const [editTab, setEditTab] = useState<EditTab>("main");
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
  const fieldDomId = (key: FieldKey) => (key === "role" ? `${roleFieldId}-role` : key);

  useEffect(() => {
    if (!pendingFocus) return;
    const wantedTab: EditTab = MORE_TAB_FIELDS.includes(pendingFocus) ? "more" : "main";
    if (isEditing && editTab !== wantedTab) {
      setEditTab(wantedTab);
      return;
    }
    document.getElementById(pendingFocus === "role" ? `${roleFieldId}-role` : pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, editTab, isEditing, roleFieldId]);

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

    const errors: FieldErrors = {};
    if (!fields.name) errors.name = REQUIRED_FIELD_MESSAGE;
    if (!fields.surname) errors.surname = REQUIRED_FIELD_MESSAGE;
    if (!isEditing && !fields.email) errors.email = REQUIRED_FIELD_MESSAGE;
    else if (!isEditing && !isValidEmail(fields.email)) errors.email = INVALID_EMAIL_MESSAGE;
    if (!isEditing && !fields.identityDocument) errors.identityDocument = REQUIRED_FIELD_MESSAGE;
    if (!formData.roleName && !isSelfWithoutRole) errors.role = ROLE_REQUIRED_MESSAGE;
    if (!user && !formData.password) errors.password = PASSWORD_REQUIRED_MESSAGE;
    else if (formData.password && !PASSWORD_POLICY.test(formData.password)) errors.password = PASSWORD_POLICY_MESSAGE;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPendingFocus(FIELD_ORDER.find((key) => errors[key]) ?? null);
      return;
    }
    setFieldErrors({});

    if (isSelfWithoutRole) {
      toast.error(SELF_WITHOUT_ROLE_MESSAGE);
      return;
    }

    if (isSelf && formData.roleName !== currentRoleName) {
      toast.error("No podés cambiar tu propio rol");
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

  const errorId = (key: FieldKey) => `${roleFieldId}-${key}-error`;
  const describedBy = (...ids: Array<string | false | undefined>) => ids.filter(Boolean).join(" ") || undefined;
  const fieldError = (key: FieldKey) =>
    fieldErrors[key] ? (
      <p id={errorId(key)} className={usersTheme.fieldError}>
        {fieldErrors[key]}
      </p>
    ) : null;

  const updateField = (key: keyof typeof formData, value: string, errorKey?: FieldKey) => {
    setFormData((current) => ({ ...current, [key]: value }));
    if (errorKey && fieldErrors[errorKey]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[errorKey];
        return next;
      });
    }
  };

  const renderRoleOption = (
    option: { value: string; label: string; description?: string },
    index: number,
    disabled: boolean,
  ) => {
    const optionId = index === 0 && !disabled ? fieldDomId("role") : `${roleFieldId}-option-${index}`;
    const descriptionId = option.description ? `${optionId}-description` : undefined;
    const style = roleStyle(option.value);
    return (
      <div key={option.value} className="relative flex min-w-0 items-start gap-2.5 rounded-lg border p-3 transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
        <input
          id={optionId}
          type="radio"
          name={`${roleFieldId}-role`}
          value={option.value}
          checked={formData.roleName === option.value}
          onChange={() => updateField("roleName", option.value, "role")}
          disabled={disabled}
          aria-describedby={describedBy(descriptionId, fieldErrors.role && errorId("role"))}
          aria-invalid={fieldErrors.role ? true : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span aria-hidden="true" className="text-base leading-5">
          {style.icon}
        </span>
        <div className="min-w-0">
          <label
            htmlFor={optionId}
            className="block cursor-pointer break-words text-sm font-medium after:absolute after:inset-0 after:content-['']"
          >
            {option.label}
          </label>
          {option.description && (
            <p id={descriptionId} className="break-words text-xs text-muted-foreground">
              {option.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  const fieldLabel = (htmlFor: string, text: React.ReactNode, required = false) => (
    <Label htmlFor={htmlFor} className={required ? usersTheme.requiredMark : undefined}>
      {text}
    </Label>
  );

  const nameFields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        {fieldLabel("name", "Nombre", true)}
        <Input
          id="name"
          placeholder="Nombre"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value, "name")}
          required
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={describedBy(fieldErrors.name && errorId("name"))}
        />
        {fieldError("name")}
      </div>
      <div className="min-w-0 space-y-1.5">
        {fieldLabel("surname", "Apellidos", true)}
        <Input
          id="surname"
          placeholder="Apellidos"
          value={formData.surname}
          onChange={(e) => updateField("surname", e.target.value, "surname")}
          required
          aria-invalid={fieldErrors.surname ? true : undefined}
          aria-describedby={describedBy(fieldErrors.surname && errorId("surname"))}
        />
        {fieldError("surname")}
      </div>
    </div>
  );

  const emailField = (
    <div className="min-w-0 space-y-1.5">
      {fieldLabel("email", "Email", !isEditing)}
      <Input
        id="email"
        type="email"
        placeholder="colaborador@empresa.com"
        value={formData.email}
        onChange={(e) => updateField("email", e.target.value, "email")}
        required
        disabled={isEditing}
        title={isEditing ? formData.email : undefined}
        aria-invalid={fieldErrors.email ? true : undefined}
        aria-describedby={describedBy(isEditing && "readonly-fields-hint", fieldErrors.email && errorId("email"))}
      />
      {fieldError("email")}
    </div>
  );

  const phoneField = (
    <div className="min-w-0 space-y-1.5">
      {fieldLabel("phoneNumber", "Teléfono")}
      <div className="flex min-w-0 overflow-hidden rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {!formData.phoneNumber.trim().startsWith("+") && (
          <span aria-hidden="true" className="flex items-center border-r bg-muted px-3 text-xs text-muted-foreground">
            +51
          </span>
        )}
        <Input
          id="phoneNumber"
          inputMode="tel"
          placeholder="987 654 321"
          value={formData.phoneNumber}
          onChange={(e) => updateField("phoneNumber", e.target.value)}
          className="min-w-0 rounded-none border-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );

  const documentField = (
    <div className="min-w-0 space-y-1.5">
      {fieldLabel("identityDocument", "DNI / Documento", !isEditing)}
      <Input
        id="identityDocument"
        placeholder="12345678"
        value={formData.identityDocument}
        onChange={(e) => updateField("identityDocument", e.target.value, "identityDocument")}
        required
        disabled={isEditing}
        aria-invalid={fieldErrors.identityDocument ? true : undefined}
        aria-describedby={describedBy(
          isEditing && "readonly-fields-hint",
          fieldErrors.identityDocument && errorId("identityDocument"),
        )}
      />
      {fieldError("identityDocument")}
    </div>
  );

  const passwordHintId = `${roleFieldId}-password-hint`;
  const passwordField = (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor="password" className={user ? undefined : usersTheme.requiredMark}>
        Contraseña{" "}
        {user && <span className="text-xs font-normal text-muted-foreground">(dejar vacío para mantener)</span>}
      </Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={user ? "••••••••" : "Mínimo 6 caracteres"}
          value={formData.password}
          onChange={(e) => updateField("password", e.target.value, "password")}
          required={!user}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={describedBy(passwordHintId, fieldErrors.password && errorId("password"))}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={showPassword}
          aria-controls="password"
          onClick={() => setShowPassword((value) => !value)}
          className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
      <p id={passwordHintId} className={usersTheme.fieldHint}>
        Al menos 6 caracteres, una letra minúscula y un número.
        {!user && " Será la contraseña definitiva: el cambio obligatorio al primer ingreso todavía no está disponible."}
      </p>
      {fieldError("password")}
    </div>
  );

  const addressFields = (
    <div className="space-y-4">
      <div className="min-w-0 space-y-1.5">
        {fieldLabel("address", "Dirección")}
        <Input
          id="address"
          placeholder="Jr. Iquique 807"
          value={formData.address}
          onChange={(e) => updateField("address", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="min-w-0 space-y-1.5">
          {fieldLabel("department", "Departamento")}
          <Select
            value={formData.department}
            onValueChange={(value) => {
              if (value) setFormData((current) => ({ ...current, department: value, province: "", district: "" }));
            }}
          >
            <SelectTrigger id="department" className="w-full min-w-0">
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
        <div className="min-w-0 space-y-1.5">
          {fieldLabel("province", "Provincia")}
          <Select
            value={formData.province}
            onValueChange={(value) => {
              if (value) setFormData((current) => ({ ...current, province: value, district: "" }));
            }}
            disabled={!formData.department}
          >
            <SelectTrigger id="province" className="w-full min-w-0">
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
        <div className="min-w-0 space-y-1.5">
          {fieldLabel("district", "Distrito")}
          <Select
            value={formData.district}
            onValueChange={(value) => {
              if (value) setFormData((current) => ({ ...current, district: value }));
            }}
            disabled={!formData.province}
          >
            <SelectTrigger id="district" className="w-full min-w-0">
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

  const roleRestrictions = (
    <>
      {isSelf && !isSelfWithoutRole && (
        <p id="own-role-hint" className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          No podés cambiar tu propio rol.
        </p>
      )}
      {isSelfWithoutRole && (
        <UsersNotice id="own-role-hint" tone="restriction" role="status" title="No podés asignarte un rol">
          {SELF_WITHOUT_ROLE_MESSAGE}
        </UsersNotice>
      )}
      {rolesStatus === "unauthenticated" && (
        <UsersNotice tone="error" title="Roles no disponibles">
          {ROLES_UNAVAILABLE_MESSAGE.unauthenticated}
        </UsersNotice>
      )}
      {(rolesStatus === "error" || rolesStatus === "empty") && (
        <UsersNotice
          tone="error"
          title="Roles no disponibles"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => {
                if (auth?.accessToken) loadRoles(auth.accessToken);
              }}
            >
              Reintentar
            </Button>
          }
        >
          {ROLES_UNAVAILABLE_MESSAGE[rolesStatus]}
        </UsersNotice>
      )}
    </>
  );

  const roleSelectField = (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={fieldDomId("role")}>Rol</Label>
      <select
        id={fieldDomId("role")}
        value={formData.roleName}
        onChange={(e) => updateField("roleName", e.target.value, "role")}
        disabled={roleSelectionDisabled}
        aria-invalid={fieldErrors.role ? true : undefined}
        aria-describedby={describedBy(isSelf && "own-role-hint", `${roleFieldId}-role-hint`, fieldErrors.role && errorId("role"))}
        className={usersTheme.nativeSelect}
      >
        <option value="">{rolesStatus === "ready" ? "Seleccionar rol" : ROLES_UNAVAILABLE_MESSAGE[rolesStatus]}</option>
        {rolesStatus === "ready" && !isCurrentRoleAssignable && (
          <option value={currentRoleName} disabled>
            {currentRoleName} (actual)
          </option>
        )}
        {rolesStatus === "ready" &&
          roles.map((role) => (
            <option key={role.id || role.name} value={role.name}>
              {role.name}
            </option>
          ))}
      </select>
      <p id={`${roleFieldId}-role-hint`} className={usersTheme.fieldHint}>
        {rolesStatus === "ready" && !isCurrentRoleAssignable
          ? "El rol actual no se puede asignar desde aquí y se conserva al guardar. "
          : ""}
        Cambiar el rol modifica los accesos del colaborador. Todavía no está definido cuándo se aplica si tiene una
        sesión abierta.
      </p>
      {fieldError("role")}
      {roleRestrictions}
    </div>
  );

  const roleCardsField = (
    <div className="min-w-0 space-y-3">
      <fieldset
        disabled={roleSelectionDisabled}
        aria-describedby={describedBy(isSelf && "own-role-hint", fieldErrors.role && errorId("role"))}
        className="min-w-0 space-y-2"
      >
        <legend className="sr-only">Rol</legend>
        {rolesStatus === "loading" && (
          <p role="status" className={usersTheme.fieldHint}>
            {ROLES_UNAVAILABLE_MESSAGE.loading}
          </p>
        )}
        {rolesStatus === "ready" && (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {!isCurrentRoleAssignable &&
              renderRoleOption({ value: currentRoleName, label: `${currentRoleName} (actual, no asignable)` }, -1, true)}
            {roles.map((role, index) =>
              renderRoleOption(
                { value: role.name, label: role.name, description: role.description?.trim() || undefined },
                index,
                false,
              ),
            )}
            <button
              type="button"
              disabled
              aria-describedby={`${roleFieldId}-custom-pending`}
              className="flex min-w-0 items-start gap-2.5 rounded-lg border border-dashed p-3 text-left opacity-70 disabled:cursor-not-allowed"
            >
              <span aria-hidden="true" className="text-base leading-5">
                ⚙️
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">Personalizado</span>
                <span id={`${roleFieldId}-custom-pending`} className="block text-xs text-muted-foreground">
                  Próximamente
                </span>
              </span>
            </button>
          </div>
        )}
      </fieldset>
      {fieldError("role")}
      {selectedRoleDescription && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{selectedRoleDescription}</p>
      )}
      {roleRestrictions}
    </div>
  );

  const readonlyHint = isEditing && (
    <p id="readonly-fields-hint" className={usersTheme.fieldHint}>
      El correo y el documento no se pueden modificar desde aquí.
    </p>
  );

  const footer = (
    <UsersDialogFooter>
      <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
        Cancelar
      </Button>
      <Button type="submit" disabled={loading || rolesStatus !== "ready" || isSelfWithoutRole}>
        {loading ? "Guardando..." : user ? "Guardar cambios" : "Crear usuario"}
      </Button>
    </UsersDialogFooter>
  );

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <UsersDialogBody>
          <Tabs value={editTab} onValueChange={(value) => setEditTab(value as EditTab)} className="gap-4">
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="main">Datos principales</TabsTrigger>
              <TabsTrigger value="more">Más datos</TabsTrigger>
            </TabsList>
            <TabsContent value="main" forceMount className="space-y-4 data-[state=inactive]:hidden">
              {nameFields}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {emailField}
                {phoneField}
              </div>
              {readonlyHint}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {roleSelectField}
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${roleFieldId}-status`}>Estado</Label>
                  <select
                    id={`${roleFieldId}-status`}
                    value={formData.status ? "active" : "inactive"}
                    disabled
                    aria-describedby={`${roleFieldId}-status-pending`}
                    className={usersTheme.nativeSelect}
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                  <p id={`${roleFieldId}-status-pending`} className={usersTheme.fieldHint}>
                    El estado todavía no se puede cambiar desde aquí.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="more" forceMount className="space-y-4 data-[state=inactive]:hidden">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {documentField}
                {passwordField}
              </div>
              {addressFields}
            </TabsContent>
          </Tabs>
        </UsersDialogBody>
        {footer}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <UsersDialogBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-labelledby={`${roleFieldId}-personal`} className="min-w-0 space-y-4">
              <h3 id={`${roleFieldId}-personal`} className="text-sm font-semibold">
                Datos personales
              </h3>
              {nameFields}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${roleFieldId}-login`} className={usersTheme.requiredMark}>
                    Usuario / login
                  </Label>
                  <Input
                    id={`${roleFieldId}-login`}
                    placeholder="ej: cmejia"
                    disabled
                    aria-describedby={`${roleFieldId}-identity-pending`}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${roleFieldId}-gender`}>Género</Label>
                  <select
                    id={`${roleFieldId}-gender`}
                    disabled
                    aria-describedby={`${roleFieldId}-identity-pending`}
                    className={usersTheme.nativeSelect}
                  >
                    <option value="">Selecciona</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <p id={`${roleFieldId}-identity-pending`} className={`${usersTheme.fieldHint} sm:col-span-2`}>
                  Usuario/login y género todavía no están disponibles: hoy el colaborador ingresa con su email y estos
                  datos no se guardan.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {emailField}
                {phoneField}
              </div>
              {documentField}
            </section>
            <section aria-labelledby={`${roleFieldId}-access`} className="min-w-0 space-y-4">
              <h3 id={`${roleFieldId}-access`} className="text-sm font-semibold">
                Rol y accesos
              </h3>
              {roleCardsField}
              <Button
                type="button"
                variant="outline"
                aria-expanded={showPermissions}
                aria-controls={`${roleFieldId}-permissions`}
                onClick={() => setShowPermissions((value) => !value)}
                className="h-auto w-full justify-between whitespace-normal py-2 text-left"
              >
                <span>Personalizar permisos por módulo y ruta</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 transition-transform ${showPermissions ? "rotate-180" : ""}`}
                />
              </Button>
            </section>
          </div>
          {showPermissions && (
            <section id={`${roleFieldId}-permissions`} aria-labelledby={`${roleFieldId}-matrix-title`} className="min-w-0 space-y-2">
              <div>
                <h3 id={`${roleFieldId}-matrix-title`} className="text-sm font-semibold">
                  Permisos específicos del usuario
                </h3>
                <p className={usersTheme.fieldHint}>
                  Vista previa con rutas de ejemplo: los permisos todavía no se pueden configurar ni se guardan.
                </p>
              </div>
              <PermissionMatrix caption="Tabla de permisos del usuario" />
            </section>
          )}
          <section aria-labelledby={`${roleFieldId}-address`} className="min-w-0 space-y-4">
            <h3 id={`${roleFieldId}-address`} className="text-sm font-semibold">
              Ubicación
            </h3>
            {addressFields}
          </section>
          <section aria-labelledby={`${roleFieldId}-password`} className="min-w-0 space-y-4 sm:max-w-sm">
            <h3 id={`${roleFieldId}-password`} className="text-sm font-semibold">
              Acceso
            </h3>
            {passwordField}
          </section>
        </div>
      </UsersDialogBody>
      {footer}
    </form>
  );
}
