"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { getMatrizPermisos } from "@/services/superadmin/equipoService";
import { ROL_LABEL, RolInterno } from "@/interfaces/superadmin";
import { SUPERADMIN_NAV } from "@/config/superadminNav.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";

const ROLES: RolInterno[] = ["super", "ventas", "soporte", "onboarding", "finanzas", "csm"];

/**
 * Matriz de permisos rol × módulo — Sección 8.11. Es una demo visual: el
 * estado se copia de ROL_MODULOS al montar y los toggles solo viven en
 * memoria de este componente (no se persiste al mock).
 */
export function MatrizPermisos() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "equipo", "matriz"], queryFn: getMatrizPermisos });
  const [matriz, setMatriz] = useState<Record<RolInterno, string[]> | null>(null);

  useEffect(() => {
    if (data) setMatriz(data);
  }, [data]);

  function toggle(rol: RolInterno, key: string) {
    setMatriz((prev) => {
      if (!prev) return prev;
      const actual = prev[rol];
      const tieneTodo = actual.includes("*");
      let siguiente: string[];
      if (tieneTodo) {
        // "*" se expande a todos los módulos menos el que se está desmarcando.
        siguiente = SUPERADMIN_NAV.map((item) => item.key).filter((k) => k !== key);
      } else if (actual.includes(key)) {
        siguiente = actual.filter((k) => k !== key);
      } else {
        siguiente = [...actual, key];
      }
      return { ...prev, [rol]: siguiente };
    });
  }

  if (isLoading || !matriz) return <TableSkeleton rows={6} cols={8} />;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Matriz de permisos (rol × módulo)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card p-2 text-left font-semibold">Rol</th>
                {SUPERADMIN_NAV.map((item) => (
                  <th key={item.key} className="whitespace-nowrap p-2 text-center font-medium text-muted-foreground">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((rol) => {
                const modulos = matriz[rol];
                const tieneTodo = modulos.includes("*");
                return (
                  <tr key={rol} className="border-t border-border/60">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-card p-2 font-semibold">{ROL_LABEL[rol]}</td>
                    {SUPERADMIN_NAV.map((item) => {
                      const activo = tieneTodo || modulos.includes(item.key);
                      return (
                        <td key={item.key} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(rol, item.key)}
                            className={cn(
                              "mx-auto flex h-6 w-6 items-center justify-center rounded border transition-colors",
                              activo
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground/30"
                            )}
                          >
                            {activo && <Check className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
