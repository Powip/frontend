"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { getCrmMe } from "@/services/crmService";
import type { CrmLevel, CrmMe, CrmStore } from "@/types/crm";

/** Respuesta de `GET /crm/me` por usuario; una sola petición por sesión. */
const cache = new Map<string, CrmMe>();
const pending = new Map<string, Promise<CrmMe | null>>();

function isCrmMe(v: unknown): v is CrmMe {
  const m = v as Partial<CrmMe> | null | undefined;
  return (
    !!m &&
    (m.level === "admin" || m.level === "supervisor" || m.level === "agent") &&
    Array.isArray(m.stores)
  );
}

function load(key: string): Promise<CrmMe | null> {
  let p = pending.get(key);
  if (!p) {
    p = Promise.resolve()
      .then(() => getCrmMe())
      .then((me) => {
        if (!isCrmMe(me)) return null;
        cache.set(key, me);
        return me;
      })
      .catch(() => null)
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

/** Solo para pruebas: olvida lo leído del servidor. */
export function resetCrmMeCache(): void {
  cache.clear();
  pending.clear();
}

export interface CrmAccess {
  level: CrmLevel;
  isAdmin: boolean;
  /** Supervisor o administrador. */
  isSupervisor: boolean;
  /** Tiendas activas de la empresa (vacío hasta que responde el servidor). */
  stores: CrmStore[];
  /** `true` cuando el nivel ya viene del servidor y no del rol local. */
  fromServer: boolean;
  /** Mostrar el teléfono del cliente oculto. Mientras no responde el servidor, se oculta a las vendedoras. */
  phoneMasked: boolean;
}

/**
 * Nivel del usuario en el CRM. Manda el servidor (`GET /crm/me`); mientras no
 * responde, o si falla, se usa el rol de la sesión para no bloquear la pantalla.
 */
export function useCrmMe(): CrmAccess {
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const key = auth?.user?.id ? String(auth.user.id) : "";
  const [me, setMe] = useState<CrmMe | null>(() => (key ? (cache.get(key) ?? null) : null));

  useEffect(() => {
    if (!key) {
      setMe(null);
      return;
    }
    const known = cache.get(key);
    if (known) {
      setMe(known);
      return;
    }
    let alive = true;
    void load(key).then((res) => {
      if (alive && res) setMe(res);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  const level: CrmLevel = me?.level ?? (hasAdminAccess(role) ? "admin" : "agent");
  return {
    level,
    isAdmin: level === "admin",
    isSupervisor: level === "admin" || level === "supervisor",
    stores: me?.stores ?? [],
    fromServer: !!me,
    phoneMasked: me ? me.phoneMasked === true : level === "agent",
  };
}
