"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrandingConfig, useGuardarBranding } from "@/hooks/superadmin/useConfig";
import { SimuladoBadge, TableSkeleton } from "@/components/superadmin/shared";

export function BrandingTab() {
  const { data, isLoading, isSimulado } = useBrandingConfig();
  const { mutate: guardar, isPending } = useGuardarBranding();

  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("");
  const [logo, setLogo] = useState("");

  // Sincroniza el form con lo que trae el hook (real o mock) la primera vez que llega.
  useEffect(() => {
    if (!data) return;
    setNombre(data.nombrePlataforma);
    setColor(data.colorPrimario);
    setLogo(data.logoUrl);
  }, [data]);

  function handleGuardar() {
    guardar(
      { nombrePlataforma: nombre, colorPrimario: color, logoUrl: logo },
      { onSuccess: () => toast.success("Cambios guardados") }
    );
  }

  if (isLoading || !data) return <TableSkeleton rows={3} cols={1} />;

  return (
    <div className="max-w-lg space-y-3.5">
      {isSimulado && (
        <div className="text-[11px] text-muted-foreground">
          <SimuladoBadge /> No existe configuración de branding real todavía — ver docs/superadmin/config-endpoints.md.
        </div>
      )}
      <div>
        <Label className="text-xs font-bold mb-1.5 block">Nombre de la plataforma</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs font-bold mb-1.5 block">Color primario</Label>
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border"
          />
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-[140px]" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-bold mb-1.5 block">URL del logo</Label>
        <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
      </div>
      <Button size="sm" onClick={handleGuardar} disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
