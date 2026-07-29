"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";

/* -----------------------------------------------------------------------
   Notificaciones automáticas por WhatsApp — funcionalidad NUEVA del
   mockup, no existe hoy. Es solo UI de plantillas: activo/inactivo y
   texto se guardan en estado local de React, no hay persistencia real ni
   envío automático de nada — ver BACKEND GAP al pie.
------------------------------------------------------------------------ */

interface Template {
  key: string;
  title: string;
  trigger: string;
  text: string;
}

const DEFAULT_TEMPLATES: (Template & { enabled: boolean })[] = [
  {
    key: "guia_creada",
    title: "Guía creada",
    trigger: "Al generar la guía de envío",
    text: "Hola {{cliente}}! Tu pedido {{orden}} ya tiene guía de envío generada. Te avisamos cuando salga a reparto.",
    enabled: false,
  },
  {
    key: "en_camino",
    title: "Pedido en camino",
    trigger: "Al aprobar la guía / pasar a EN_ENVIO",
    text: "Hola {{cliente}}! Tu pedido {{orden}} ya está en camino con {{courier}}. Puedes rastrearlo aquí: {{link_rastreo}}",
    enabled: false,
  },
  {
    key: "entregado",
    title: "Pedido entregado",
    trigger: "Al confirmar la entrega",
    text: "Hola {{cliente}}! Confirmamos la entrega de tu pedido {{orden}}. ¡Gracias por tu compra!",
    enabled: false,
  },
  {
    key: "recordatorio_pago",
    title: "Recordatorio de saldo pendiente",
    trigger: "24h antes de la entrega estimada, si hay saldo por cobrar",
    text: "Hola {{cliente}}! Recuerda que tu pedido {{orden}} tiene un saldo pendiente de S/{{saldo}} a pagar contra entrega.",
    enabled: false,
  },
];

export default function WhatsAppNotificationsSection() {
  const { can } = useOperationsRole();
  const canEdit = can(OPS_PERMISSIONS.MANAGE_TARIFARIO);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  const toggle = (key: string) => {
    if (!canEdit) return;
    setTemplates((prev) => prev.map((t) => (t.key === key ? { ...t, enabled: !t.enabled } : t)));
  };

  const updateText = (key: string, text: string) => {
    if (!canEdit) return;
    setTemplates((prev) => prev.map((t) => (t.key === key ? { ...t, text } : t)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">Notificaciones automáticas por WhatsApp</h3>
          <p className="text-xs text-muted-foreground">
            Plantillas de mensajes automáticos por evento de guía. Funcionalidad nueva — ver nota abajo.
          </p>
        </div>
        {!canEdit && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Solo lectura
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {templates.map((t) => (
          <div key={t.key} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">{t.trigger}</p>
              </div>
              <Switch checked={t.enabled} onCheckedChange={() => toggle(t.key)} disabled={!canEdit} />
            </div>
            <Textarea
              value={t.text}
              onChange={(e) => updateText(t.key, e.target.value)}
              disabled={!canEdit}
              rows={3}
              className="mt-2 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
