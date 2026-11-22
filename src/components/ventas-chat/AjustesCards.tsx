"use client";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { crmError } from "@/services/crmService";
import { useTeamMembers, useUpdateCrmSettings } from "@/hooks/useCrmTeam";
import type { AssignMode, CrmSettings, TeamPerson } from "@/types/crmTeam";
import AjustesCard, { useDraft } from "./AjustesCard";

export const MAX_MESSAGE = 600;
const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Lunes primero. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function errMsg(m: ReturnType<typeof useUpdateCrmSettings>) {
  return m.isError ? crmError(m.error).message : null;
}

function MessageField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        maxLength={MAX_MESSAGE}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-[11px] text-muted-foreground">
        {value.length}/{MAX_MESSAGE} · Puedes usar {"{nombre}"} para el nombre del contacto.
      </p>
    </div>
  );
}

export function SlaCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettings();
  const { draft, setDraft, dirty } = useDraft(settings.slaMinutes);
  const valid = Number.isInteger(draft) && draft >= 1 && draft <= 720;
  return (
    <AjustesCard
      id="sla"
      title="Tiempo de respuesta (SLA)"
      description="Minutos sin respuesta para marcar un chat como «esperando» en la pestaña Equipo. No envía nada ni cambia a nadie de chat: solo sirve para detectar chats desatendidos."
      canSave={dirty && valid}
      saving={m.isPending}
      onSave={() => m.mutate({ slaMinutes: draft })}
      error={errMsg(m)}
      hint={valid ? null : "Elige un número entero entre 1 y 720."}
    >
      <div className="flex items-center gap-2">
        <Label htmlFor="sla-minutes">Minutos</Label>
        <Input
          id="sla-minutes"
          type="number"
          min={1}
          max={720}
          className="w-28"
          value={Number.isFinite(draft) ? draft : ""}
          onChange={(e) => setDraft(e.target.value === "" ? NaN : Number(e.target.value))}
        />
      </div>
    </AjustesCard>
  );
}

type AwayDraft = Pick<CrmSettings, "hours" | "awayEnabled" | "awayMessage">;

export function HoursCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettings();
  const server: AwayDraft = {
    hours: settings.hours,
    awayEnabled: settings.awayEnabled,
    awayMessage: settings.awayMessage,
  };
  const { draft, setDraft, dirty } = useDraft(server);
  const toggleDay = (d: number, on: boolean) =>
    setDraft((cur) => ({
      ...cur,
      hours: {
        ...cur.hours,
        days: on
          ? [...cur.hours.days.filter((x) => x !== d), d].sort((a, b) => a - b)
          : cur.hours.days.filter((x) => x !== d),
      },
    }));
  const emptyMessage = draft.awayEnabled && !draft.awayMessage.trim();
  return (
    <AjustesCard
      id="hours"
      title="Horario de atención y respuesta fuera de horario"
      description="Cuando un cliente escribe fuera de este horario, se le responde solo con el mensaje de abajo (máximo una vez cada 12 horas por chat). No se envía si Pau está en modo «responde solo», porque Pau ya contesta."
      canSave={dirty && !emptyMessage}
      saving={m.isPending}
      onSave={() =>
        m.mutate({
          hours: draft.hours,
          awayEnabled: draft.awayEnabled,
          awayMessage: draft.awayMessage,
        })
      }
      error={errMsg(m)}
      hint={emptyMessage ? "Escribe el mensaje para poder activarlo." : null}
    >
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Días de atención</legend>
        <div className="flex flex-wrap gap-3">
          {DAY_ORDER.map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={draft.hours.days.includes(d)}
                onCheckedChange={(v) => toggleDay(d, v === true)}
                aria-label={DAY_LABELS[d]}
              />
              {DAY_LABELS[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="hours-start">Desde</Label>
          <Input
            id="hours-start"
            type="time"
            className="w-28"
            value={draft.hours.start}
            onChange={(e) =>
              setDraft((c) => ({ ...c, hours: { ...c.hours, start: e.target.value } }))
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="hours-end">Hasta</Label>
          <Input
            id="hours-end"
            type="time"
            className="w-28"
            value={draft.hours.end}
            onChange={(e) =>
              setDraft((c) => ({ ...c, hours: { ...c.hours, end: e.target.value } }))
            }
          />
        </div>
        <span className="text-xs text-muted-foreground">Hora de Lima</span>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="away-enabled"
          checked={draft.awayEnabled}
          onCheckedChange={(v) => setDraft((c) => ({ ...c, awayEnabled: v }))}
        />
        <Label htmlFor="away-enabled">Responder automáticamente fuera de horario</Label>
      </div>
      <MessageField
        id="away-message"
        label="Mensaje fuera de horario"
        value={draft.awayMessage}
        onChange={(v) => setDraft((c) => ({ ...c, awayMessage: v }))}
      />
    </AjustesCard>
  );
}

type WelcomeDraft = Pick<CrmSettings, "welcomeEnabled" | "welcomeMessage">;

export function WelcomeCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettings();
  const server: WelcomeDraft = {
    welcomeEnabled: settings.welcomeEnabled,
    welcomeMessage: settings.welcomeMessage,
  };
  const { draft, setDraft, dirty } = useDraft(server);
  const emptyMessage = draft.welcomeEnabled && !draft.welcomeMessage.trim();
  const preview = draft.welcomeMessage.replace(/\{nombre\}/g, "María");
  return (
    <AjustesCard
      id="welcome"
      title="Bienvenida"
      description="Se envía sola al primer mensaje de un contacto nuevo. No se envía si Pau está en modo «responde solo», porque Pau ya contesta."
      canSave={dirty && !emptyMessage}
      saving={m.isPending}
      onSave={() =>
        m.mutate({ welcomeEnabled: draft.welcomeEnabled, welcomeMessage: draft.welcomeMessage })
      }
      error={errMsg(m)}
      hint={emptyMessage ? "Escribe el mensaje para poder activarlo." : null}
    >
      <div className="flex items-center gap-2">
        <Switch
          id="welcome-enabled"
          checked={draft.welcomeEnabled}
          onCheckedChange={(v) => setDraft((c) => ({ ...c, welcomeEnabled: v }))}
        />
        <Label htmlFor="welcome-enabled">Enviar mensaje de bienvenida</Label>
      </div>
      <MessageField
        id="welcome-message"
        label="Mensaje de bienvenida"
        value={draft.welcomeMessage}
        onChange={(v) => setDraft((c) => ({ ...c, welcomeMessage: v }))}
      />
      <div className="rounded-md border bg-muted/30 p-3" data-testid="welcome-preview">
        <p className="text-[11px] font-medium text-muted-foreground">Vista previa (contacto: María)</p>
        <p className="whitespace-pre-wrap text-sm">{preview || "—"}</p>
      </div>
    </AjustesCard>
  );
}

type AssignDraft = { assignMode: AssignMode; assignUsers: TeamPerson[] };

export function AssignCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettings();
  const members = useTeamMembers();
  const server: AssignDraft = {
    assignMode: settings.assignMode,
    assignUsers: settings.assignUsers,
  };
  const { draft, setDraft, dirty } = useDraft(server);
  const selected = new Set(draft.assignUsers.map((u) => u.userId));
  // Personas ya elegidas que ya no aparecen en la lista siguen visibles para poder quitarlas.
  const people = [
    ...(members.data ?? []),
    ...draft.assignUsers.filter((u) => !(members.data ?? []).some((p) => p.userId === u.userId)),
  ];
  const toggle = (p: TeamPerson, on: boolean) =>
    setDraft((c) => ({
      ...c,
      assignUsers: on
        ? [...c.assignUsers.filter((u) => u.userId !== p.userId), p]
        : c.assignUsers.filter((u) => u.userId !== p.userId),
    }));
  const needsPeople = draft.assignMode === "round_robin" && draft.assignUsers.length === 0;
  return (
    <AjustesCard
      id="assign"
      title="Reparto de chats nuevos"
      description="Manual: los chats nuevos quedan sin asignar y alguien los toma. Por turnos: cada chat nuevo se asigna por turnos entre las personas elegidas."
      canSave={dirty && !needsPeople}
      saving={m.isPending}
      onSave={() => m.mutate({ assignMode: draft.assignMode, assignUsers: draft.assignUsers })}
      error={errMsg(m)}
      hint={needsPeople ? "Elige al menos una persona para repartir por turnos." : null}
    >
      <div role="radiogroup" aria-label="Modo de reparto" className="flex flex-wrap gap-4 text-sm">
        {(
          [
            ["manual", "Manual"],
            ["round_robin", "Por turnos"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="assign-mode"
              value={value}
              checked={draft.assignMode === value}
              onChange={() => setDraft((c) => ({ ...c, assignMode: value }))}
            />
            {label}
          </label>
        ))}
      </div>
      {members.isLoading && <p className="text-xs text-muted-foreground">Cargando personas…</p>}
      {members.isError && (
        <p role="alert" className="text-xs text-destructive">
          No se pudo cargar la lista de personas: {crmError(members.error).message}
        </p>
      )}
      {members.data && people.length === 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          Todavía no hay personas con actividad en el CRM. Aparecerán aquí cuando atiendan chats o
          reciban tareas.
        </p>
      )}
      {people.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium">Personas que reciben chats</legend>
          <div className="flex flex-wrap gap-3">
            {people.map((p) => (
              <label key={p.userId} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={selected.has(p.userId)}
                  onCheckedChange={(v) => toggle(p, v === true)}
                  aria-label={p.userName}
                />
                {p.userName}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </AjustesCard>
  );
}

const WHERE: Array<{ label: string; href: string; text: string }> = [
  { label: "Pau", href: "/comercial/ventas-chat/pau", text: "Agente de IA: modo, proveedor, instrucciones y uso." },
  { label: "Seguimientos", href: "/comercial/ventas-chat/seguimientos", text: "Reglas que escriben solas cuando el cliente o el equipo se quedan callados." },
  { label: "Difusiones", href: "/comercial/ventas-chat/difusiones", text: "Mensajes masivos con plantilla a un público elegido." },
  { label: "Embudo", href: "/comercial/ventas-chat/embudo", text: "Etapas del proceso de venta y motivos de pérdida." },
  { label: "Guion y material", href: "/comercial/ventas-chat/guion", text: "Guion de venta, fichas de producto y material para el equipo." },
  { label: "Objeciones", href: "/comercial/ventas-chat/objeciones", text: "Respuestas preparadas a las dudas más comunes." },
];

export function WhereCard() {
  return (
    <section aria-labelledby="where-title" className="space-y-2 rounded-md border bg-card p-4">
      <h2 id="where-title" className="text-sm font-semibold">
        Dónde se configura cada cosa
      </h2>
      <ul className="divide-y text-sm">
        {WHERE.map((w) => (
          <li key={w.href} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
            <Link href={w.href} className="font-medium text-primary hover:underline">
              {w.label}
            </Link>
            <span className="text-xs text-muted-foreground">{w.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type LimitsDraft = Pick<CrmSettings, "followupWeeklyMax" | "followupSendStart" | "followupSendEnd">;

/** Límites de los seguimientos automáticos (se muestra en Seguimientos). */
export function FollowupLimitsCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettings();
  const server: LimitsDraft = {
    followupWeeklyMax: settings.followupWeeklyMax,
    followupSendStart: settings.followupSendStart,
    followupSendEnd: settings.followupSendEnd,
  };
  const { draft, setDraft, dirty } = useDraft(server);
  const maxOk =
    Number.isInteger(draft.followupWeeklyMax) &&
    draft.followupWeeklyMax >= 1 &&
    draft.followupWeeklyMax <= 20;
  const hoursOk =
    /^\d{2}:\d{2}$/.test(draft.followupSendStart) &&
    /^\d{2}:\d{2}$/.test(draft.followupSendEnd) &&
    draft.followupSendStart < draft.followupSendEnd;
  return (
    <AjustesCard
      id="followup-limits"
      title="Límites"
      description="Para no cansar al cliente: tope de mensajes automáticos por cliente en 7 días (sumando todas las reglas) y horario en que se envían (hora de Lima). Si el cliente responde, el seguimiento pendiente se cancela solo."
      canSave={dirty && maxOk && hoursOk}
      saving={m.isPending}
      onSave={() => m.mutate(draft)}
      error={errMsg(m)}
      hint={
        !maxOk
          ? "El tope semanal va de 1 a 20 mensajes."
          : !hoursOk
            ? "El horario de envío debe empezar antes de terminar."
            : null
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="limits-weekly">Máximo por semana</Label>
          <Input
            id="limits-weekly"
            type="number"
            min={1}
            max={20}
            className="w-20"
            value={Number.isFinite(draft.followupWeeklyMax) ? draft.followupWeeklyMax : ""}
            onChange={(e) =>
              setDraft((cur) => ({
                ...cur,
                followupWeeklyMax: e.target.value === "" ? NaN : Number(e.target.value),
              }))
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="limits-start">Enviar desde</Label>
          <Input
            id="limits-start"
            type="time"
            className="w-28"
            value={draft.followupSendStart}
            onChange={(e) => setDraft((cur) => ({ ...cur, followupSendStart: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="limits-end">hasta</Label>
          <Input
            id="limits-end"
            type="time"
            className="w-28"
            value={draft.followupSendEnd}
            onChange={(e) => setDraft((cur) => ({ ...cur, followupSendEnd: e.target.value }))}
          />
        </div>
      </div>
    </AjustesCard>
  );
}

export function MaskPhoneCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettings();
  const { draft, setDraft, dirty } = useDraft(settings.maskPhone);
  return (
    <AjustesCard
      id="mask-phone"
      title="Privacidad del cliente"
      description="Las vendedoras ven el teléfono del cliente como «951 *** 245». Llaman y escriben desde POWIP, sin copiar el número. Los administradores siempre ven el número completo."
      canSave={dirty}
      saving={m.isPending}
      onSave={() => m.mutate({ maskPhone: draft })}
      error={errMsg(m)}
    >
      <div className="flex items-center gap-2">
        <Switch id="mask-phone-enabled" checked={draft} onCheckedChange={(v) => setDraft(v)} />
        <Label htmlFor="mask-phone-enabled">Ocultar el teléfono completo a las vendedoras</Label>
      </div>
    </AjustesCard>
  );
}
