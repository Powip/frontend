"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      iconClassName="bg-orange-100 dark:bg-orange-500/20"
      title="Crear rol personalizado"
      subtitle="Define un perfil de acceso exacto para un tipo de colaborador"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled aria-describedby={noticeId}>
            Guardar rol personalizado
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <PendingBackendNotice id={noticeId} title="Roles personalizados todavía no habilitados">
          Podés revisar el formulario y la matriz, pero todavía no se puede crear ningún rol.
        </PendingBackendNotice>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${fieldId}-name`} className={usersTheme.requiredMark}>
              Nombre del rol
            </Label>
            <Input
              id={`${fieldId}-name`}
              placeholder="Ej: Asistente de ventas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${fieldId}-description`}>Descripción corta</Label>
            <Input
              id={`${fieldId}-description`}
              placeholder="¿Para qué tipo de colaborador es?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Color identificador</legend>
          <div className="flex flex-wrap gap-2.5">
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
                  className="block h-7 w-7 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                  style={{ backgroundColor: option.value }}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <section aria-labelledby={`${fieldId}-matrix`} className="min-w-0 space-y-2">
          <div>
            <h3 id={`${fieldId}-matrix`} className="text-sm font-medium">
              Matriz de permisos
            </h3>
            <p className={usersTheme.fieldHint}>Vista previa con rutas de ejemplo: las casillas todavía no se pueden marcar.</p>
          </div>
          <PermissionMatrix caption="Permisos del rol personalizado" />
        </section>
      </div>
    </UsersModalShell>
  );
}
