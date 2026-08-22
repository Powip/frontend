"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

interface SeguridadItem {
  clave: string;
  label: string;
  descripcion: string;
  activo: boolean;
}

const ITEMS_INICIALES: SeguridadItem[] = [
  {
    clave: "2fa_dinero",
    label: "Exigir 2FA para roles con acceso a dinero",
    descripcion: "Finanzas y Super Admin deben confirmar con doble factor en cada login.",
    activo: true,
  },
  {
    clave: "expirar_sesion",
    label: "Expirar sesión tras 30 min de inactividad",
    descripcion: "Cierra la sesión automáticamente si no hay actividad en el panel.",
    activo: true,
  },
  {
    clave: "whitelist_ip",
    label: "Restringir por whitelist de IPs",
    descripcion: "Solo permite acceso al Super Admin desde IPs autorizadas.",
    activo: false,
  },
  {
    clave: "politica_password",
    label: "Política de contraseña fuerte",
    descripcion: "Exige mínimo 10 caracteres, mayúsculas, números y símbolos.",
    activo: true,
  },
];

export function SeguridadTab() {
  const [items, setItems] = useState(ITEMS_INICIALES);

  function toggle(clave: string) {
    setItems((prev) => prev.map((i) => (i.clave === clave ? { ...i, activo: !i.activo } : i)));
  }

  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.clave} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold">{i.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{i.descripcion}</div>
          </div>
          <Switch checked={i.activo} onCheckedChange={() => toggle(i.clave)} />
        </div>
      ))}
    </div>
  );
}
