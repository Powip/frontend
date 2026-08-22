"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingTab() {
  const [nombre, setNombre] = useState("POWIP");
  const [color, setColor] = useState("#0F9D8A");
  const [logo, setLogo] = useState("https://cdn.powip.pe/brand/logo.png");

  function handleGuardar() {
    toast.success("Cambios guardados");
  }

  return (
    <div className="max-w-lg space-y-3.5">
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
      <Button size="sm" onClick={handleGuardar}>
        Guardar cambios
      </Button>
    </div>
  );
}
