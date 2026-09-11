"use client";

import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCuentasMp, useActualizarMetodoPagoMp } from "@/hooks/superadmin/useComisionesMp";
import { TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";

/** Control de métodos de pago por negocio (§8, §10 regla 2): la Tarjeta MP viaja siempre
 * activa junto con la cuenta; Yape dentro de MP y Yape directo se prenden/apagan acá
 * como los toggles del mockup Super Admin — Yape directo es 0% comisión y depende
 * 100% de esta pantalla, el negocio no lo controla desde su propio panel. */
export function MetodosPagoTable() {
  const { data, isLoading, isSimulado } = useCuentasMp();
  const { mutate: actualizar } = useActualizarMetodoPagoMp();

  function toggle(empresaId: string, empresaNombre: string, campo: "yapeMpActivo" | "yapeDirectoActivo", valor: boolean, label: string) {
    actualizar(
      { empresaId, campo, valor },
      { onSuccess: () => toast.success(`${label} ${valor ? "activado" : "desactivado"} para ${empresaNombre}.`) }
    );
  }

  if (isLoading) return <TableSkeleton rows={6} cols={4} />;
  if (!data.data.length) {
    return <EmptyBlock icon={CreditCard} title="Sin negocios" description="No hay negocios con Mercado Pago conectado." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {data.data.map((c, i) => (
        <div key={c.empresaId} className={`flex flex-wrap items-center gap-4 px-4 py-3 text-xs ${i > 0 ? "border-t" : ""}`}>
          <div className="min-w-[160px] font-semibold">
            {c.empresaNombre}
            {isSimulado && <SimuladoBadge />}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">Tarjeta MP</span>
            <Switch checked={c.activa} disabled />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Yape dentro de MP</span>
            <Switch
              checked={c.yapeMpActivo}
              onCheckedChange={(v) => toggle(c.empresaId, c.empresaNombre, "yapeMpActivo", v, "Yape dentro de MP")}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Yape directo (0% comisión)</span>
            <Switch
              checked={c.yapeDirectoActivo}
              onCheckedChange={(v) => toggle(c.empresaId, c.empresaNombre, "yapeDirectoActivo", v, "Yape directo")}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
