"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { PendingBackendNotice } from "./PendingBackendNotice";
import { PermissionMatrix } from "./PermissionMatrix";
import { UsersModalShell } from "./UsersModalShell";
import { usersTheme } from "./usersTheme";

interface CreateRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ROLE_COLORS = [
  { value: "#5b21b6", label: "Violeta" },
  { value: "#0f766e", label: "Verde azulado" },
  { value: "#c2410c", label: "Naranja" },
  { value: "#be185d", label: "Rosa" },
  { value: "#1e40af", label: "Azul" },
  { value: "#15803d", label: "Verde" },
];

export function CreateRoleModal({ open, onOpenChange }: CreateRoleModalProps) {
  const fieldId = useId();
  const noticeId = `${fieldId}-pending`;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(ROLE_COLORS[0].value);

  return (
    <UsersModalShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon="🔑"
      iconClassName="bg-[#fff7ed]"
      title="Crear rol personalizado"
      subtitle="Define un perfil de acceso exacto para un tipo de colaborador"
      footer={
        <>
          <button type="button" className={usersTheme.secondaryButton} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="button" className={usersTheme.primaryButton} disabled aria-describedby={noticeId}>
            Guardar rol personalizado
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <PendingBackendNotice
          id={noticeId}
          title="Roles personalizados todavía no habilitados"
        >
          Podés revisar el formulario, pero todavía no se puede crear ningún rol.
        </PendingBackendNotice>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`${fieldId}-name`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
              Nombre del rol
            </label>
            <Input
              id={`${fieldId}-name`}
              placeholder="Ej: Asistente de ventas, Supervisor de despacho..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={usersTheme.input}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${fieldId}-description`} className={usersTheme.fieldLabel}>
              Descripción corta
            </label>
            <Input
              id={`${fieldId}-description`}
              placeholder="¿Para qué tipo de colaborador es este rol?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={usersTheme.input}
            />
          </div>
        </div>
        <fieldset>
          <legend className={usersTheme.fieldLabel}>Color identificador</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ROLE_COLORS.map((option) => (
              <label key={option.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`${fieldId}-color`}
                  value={option.value}
                  checked={color === option.value}
                  onChange={() => setColor(option.value)}
                  aria-label={option.label}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="block h-[26px] w-[26px] rounded-full border-2 border-transparent ring-offset-2 peer-checked:border-[#0f766e] peer-focus-visible:ring-2 peer-focus-visible:ring-[#4C2FB5]"
                  style={{ backgroundColor: option.value }}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <h3 className={`${usersTheme.sectionTitle} mb-1`}>Matriz de permisos</h3>
          <p className="mb-3 text-xs text-[#8b87a3]">
            Selecciona exactamente a qué puede acceder este rol. Puedes marcar por sección completa o ruta individual.
          </p>
          <PermissionMatrix caption="Permisos del rol personalizado" />
        </div>
      </div>
    </UsersModalShell>
  );
}
