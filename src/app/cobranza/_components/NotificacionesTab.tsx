"use client";

import { useState } from "react";
import { Info, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NOTIFICACIONES_INICIALES, NotificacionTemplate } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Notificaciones automáticas — WhatsApp al cliente en cada cambio de estado
   (§12 de la especificación). Se disparan solas con el tracking del courier
   y los eventos de pago; acá solo se activan/pausan las plantillas.
------------------------------------------------------------------------ */

export default function NotificacionesTab() {
  const [templates, setTemplates] = useState<NotificacionTemplate[]>(NOTIFICACIONES_INICIALES);

  const toggle = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, activo: !t.activo };
        toast.success(`"${t.trigger}" ${next.activo ? "activada" : "pausada"}`);
        return next;
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
        <p className="text-blue-900 dark:text-blue-200">
          Se disparan solas con el tracking del courier y los eventos de pago. Puedes editar cada plantilla y
          activarla o pausarla.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="flex w-40 shrink-0 items-center gap-2 text-sm font-semibold">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                {t.trigger}
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-sm bg-green-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-green-950 dark:bg-green-500/10 dark:text-green-100">
                {t.mensaje}
              </div>
              <Switch checked={t.activo} onCheckedChange={() => toggle(t.id)} className="mt-1 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
