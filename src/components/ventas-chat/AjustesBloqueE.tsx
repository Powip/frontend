"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useChannelAccounts } from "@/hooks/useCrmPlan";
import { useTeamMembers } from "@/hooks/useCrmTeam";
import { useStorePolicy } from "@/hooks/useCrmOrderPanel";
import { useUpdateCrmSettingsE } from "@/hooks/useCrmAjustesE";
import type { CrmSettings, TeamPerson } from "@/types/crmTeam";
import {
  COD_MAX_USERS,
  WELCOME_ACTIONS,
  WELCOME_ACTION_LABEL,
  WELCOME_BUTTON_MAX,
  WELCOME_MAX_BUTTONS,
  type AttributionCod,
  type AttributionPau,
  type CrmSettingsE,
  type MemberStores,
  type StoreWelcome,
  type WelcomeAction,
} from "@/types/crmAjustesE";
import AjustesCard, { useDraft } from "./AjustesCard";
import { PolicyDialog } from "./OrderPanelSections";
import { NATIVE_SELECT_CLASS, formatMoney } from "./format";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  facebook: "Facebook",
  tiktok: "TikTok",
};

const asE = (s: CrmSettings) => s as unknown as CrmSettingsE;

function errMsg(m: ReturnType<typeof useUpdateCrmSettingsE>) {
  return m.isError ? crmError(m.error).message : null;
}

/** Personas del equipo más las ya elegidas que ya no aparecen (para poder quitarlas). */
function usePeople(extra: TeamPerson[] = []) {
  const members = useTeamMembers();
  const list = members.data ?? [];
  return { members, people: [...list, ...extra.filter((u) => !list.some((p) => p.userId === u.userId))] };
}

/** Tiendas que atiende una persona. Sin fila o lista vacía = todas. */
export function storesOf(userId: string, memberStores: MemberStores[] | undefined, allIds: string[]): string[] {
  const row = memberStores?.find((m) => m.userId === userId);
  return row && row.storeIds.length ? row.storeIds.filter((id) => allIds.includes(id)) : allIds;
}

/** Tarjeta informativa sin botón Guardar. */
function InfoCard({ id, title, description, children }: { id: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-md border bg-card p-4" data-testid={`card-${id}`}>
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-sm font-semibold">{title}</h2>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {children}
    </section>
  );
}

// ---------------- J3: canales agrupados por tienda ----------------

export function StoresChannelsCard({ settings }: { settings?: CrmSettings }) {
  const { stores } = useCrmMe();
  const accounts = useChannelAccounts();
  const members = useTeamMembers();
  const rows = accounts.data ?? [];
  const allIds = stores.map((s) => s.id);
  const groups = [
    ...stores.map((s) => ({ id: s.id, name: s.name, accounts: rows.filter((a) => a.storeId === s.id) })),
    { id: "", name: "Sin tienda", accounts: rows.filter((a) => !a.storeId || !allIds.includes(a.storeId)) },
  ].filter((g) => g.id || g.accounts.length);
  const sellersOf = (storeId: string) =>
    storeId
      ? (members.data ?? []).filter((p) => storesOf(p.userId, settings ? asE(settings).memberStores : [], allIds).includes(storeId)).length
      : 0;

  return (
    <InfoCard
      id="stores-channels"
      title="Tus tiendas y sus canales"
      description="Cada tienda con sus números y páginas. Los chats de una cuenta pasan a su tienda; cambia la tienda en «Cuentas conectadas»."
    >
      {accounts.isLoading && <p role="status" className="text-xs text-muted-foreground">Cargando cuentas…</p>}
      {accounts.isError && <p role="alert" className="text-xs text-destructive">{crmError(accounts.error).message}</p>}
      {!accounts.isLoading && groups.length === 0 && (
        <p className="text-xs text-muted-foreground">Aún no tienes tiendas. Créalas en Configuración › Tiendas.</p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g.id || "none"} className="space-y-2 rounded-md border p-3" data-testid={`store-group-${g.id || "none"}`}>
            <div>
              <p className="text-sm font-medium">{g.name}</p>
              <p className="text-xs text-muted-foreground">
                {g.accounts.length} {g.accounts.length === 1 ? "cuenta conectada" : "cuentas conectadas"}
                {g.id && ` · ${sellersOf(g.id)} ${sellersOf(g.id) === 1 ? "vendedora" : "vendedoras"}`}
              </p>
            </div>
            {g.accounts.length > 0 && (
              <ul className="space-y-1 text-xs">
                {g.accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="font-medium">{CHANNEL_LABEL[a.channel] ?? a.channel}</span>
                    <span className="truncate text-muted-foreground">{a.name || a.accountId}</span>
                    {!a.isActive && <Badge variant="outline">Desconectada</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild size="sm" variant="outline">
              <a href="#aj-canales">Conectar cuenta</a>
            </Button>
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}

// ---------------- J4: Gestión COD ----------------

export function CodCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettingsE();
  const server = { codUserIds: asE(settings).codUserIds ?? [] };
  const { draft, setDraft, dirty } = useDraft(server);
  const { members, people } = usePeople();
  const full = draft.codUserIds.length >= COD_MAX_USERS;
  const toggle = (id: string, on: boolean) =>
    setDraft((c) => ({ codUserIds: on ? [...c.codUserIds.filter((x) => x !== id), id] : c.codUserIds.filter((x) => x !== id) }));
  return (
    <AjustesCard
      id="cod"
      title="Gestión de pedidos contra entrega"
      description={`Quién confirma los pedidos contra entrega (COD) antes de despacharlos. Máximo ${COD_MAX_USERS} personas.`}
      canSave={dirty}
      saving={m.isPending}
      onSave={() => m.mutate({ codUserIds: draft.codUserIds })}
      error={errMsg(m)}
      hint={full ? `Ya elegiste ${COD_MAX_USERS} personas: quita una para cambiarla.` : null}
    >
      {members.isLoading && <p className="text-xs text-muted-foreground">Cargando personas…</p>}
      {members.isError && <p role="alert" className="text-xs text-destructive">{crmError(members.error).message}</p>}
      <div className="flex flex-wrap gap-3">
        {people.map((p) => {
          const on = draft.codUserIds.includes(p.userId);
          return (
            <label key={p.userId} className={cn("flex items-center gap-1.5 text-sm", !on && full && "opacity-50")}>
              <Checkbox
                checked={on}
                disabled={!on && full}
                onCheckedChange={(v) => toggle(p.userId, v === true)}
                aria-label={`COD: ${p.userName}`}
              />
              {p.userName}
            </label>
          );
        })}
      </div>
      <Link href="/atencion-cliente" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
        Abrir Gestión CC
      </Link>
    </AjustesCard>
  );
}

// ---------------- J5: Pagos y cobros ----------------

function PolicySummary({ storeId }: { storeId: string }) {
  const policy = useStorePolicy(storeId);
  const [open, setOpen] = useState(false);
  if (policy.isLoading) return <span className="text-xs text-muted-foreground">Cargando…</span>;
  if (policy.isError || !policy.data) {
    return <span role="alert" className="text-xs text-destructive">{crmError(policy.error).message}</span>;
  }
  const p = policy.data;
  const parts = [
    p.depositEnabled ? `Adelanto ${formatMoney(p.depositAmount)}` : "Sin adelanto",
    p.codFull ? "Contra entrega completo" : "Contra entrega con adelanto",
    `Envío ${formatMoney(p.shipCharge)}`,
    `Descuento hasta ${p.discountCap}%`,
  ];
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>
      {!p.saved && <Badge variant="outline">General</Badge>}
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Editar</Button>
      {open && <PolicyDialog policy={p} onClose={() => setOpen(false)} />}
    </span>
  );
}

export function PaymentsCard() {
  const { stores } = useCrmMe();
  const [storeId, setStoreId] = useState("");
  const current = storeId || stores[0]?.id || "";
  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
      <span className="text-sm">{label}</span>
      {children}
    </li>
  );
  return (
    <InfoCard
      id="payments"
      title="Pagos y cobros"
      description="Cómo cobra cada tienda. La política de pago la usan Pau y las vendedoras al armar el pedido."
    >
      <ul>
        <Row label="Política de pago por tienda">
          <span className="flex flex-wrap items-center gap-2">
            {stores.length > 1 && (
              <select
                aria-label="Tienda de la política"
                value={current}
                onChange={(e) => setStoreId(e.target.value)}
                className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-36")}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <PolicySummary key={current} storeId={current} />
          </span>
        </Row>
        <Row label="Métodos de cobro propios">
          <Link href="/configuracion/empresa" className="text-xs font-medium text-primary hover:underline">
            Configurar en Empresa
          </Link>
        </Row>
        <Row label="Agencias Shalom">
          <span className="flex items-center gap-2">
            <Badge variant="secondary">Core</Badge>
            <Link href="/configuracion/integraciones/shalom" className="text-xs font-medium text-primary hover:underline">
              Ver integración
            </Link>
          </span>
        </Row>
        <Row label="El ingreso se reconoce">
          <Badge variant="outline">Al validar el pago</Badge>
        </Row>
        <Row label="POWIP Pay">
          <Badge variant="outline">Por definir</Badge>
        </Row>
      </ul>
    </InfoCard>
  );
}

// ---------------- J6: bienvenida por tienda con botones ----------------

const emptyWelcome = (storeId: string): StoreWelcome => ({ storeId, enabled: false, message: "", buttons: [] });

export function welcomeProblem(w: StoreWelcome): string | null {
  if (w.enabled && !w.message.trim()) return "Escribe el mensaje antes de activarlo.";
  if (w.buttons.length > WELCOME_MAX_BUTTONS) return `WhatsApp permite hasta ${WELCOME_MAX_BUTTONS} botones.`;
  if (w.buttons.some((b) => !b.text.trim())) return "Cada botón necesita un texto.";
  if (w.buttons.some((b) => b.text.trim().length > WELCOME_BUTTON_MAX)) return `Cada botón admite hasta ${WELCOME_BUTTON_MAX} caracteres.`;
  const texts = w.buttons.map((b) => b.text.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) return "Dos botones no pueden tener el mismo texto.";
  return null;
}

export function StoreWelcomeCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettingsE();
  const { stores } = useCrmMe();
  const server = { welcomeByStore: asE(settings).welcomeByStore ?? [] };
  const { draft, setDraft, dirty } = useDraft(server);
  const [tab, setTab] = useState("");
  const storeId = tab || stores[0]?.id || "";
  const current = draft.welcomeByStore.find((w) => w.storeId === storeId) ?? emptyWelcome(storeId);
  const edit = (patch: Partial<StoreWelcome>) =>
    setDraft((c) => ({
      welcomeByStore: [...c.welcomeByStore.filter((w) => w.storeId !== storeId), { ...current, ...patch }],
    }));
  const setButton = (i: number, patch: Partial<StoreWelcome["buttons"][number]>) =>
    edit({ buttons: current.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const problem = draft.welcomeByStore.map(welcomeProblem).find(Boolean) ?? null;

  if (!stores.length) {
    return (
      <InfoCard id="store-welcome" title="Bienvenida por tienda" description="Necesitas al menos una tienda.">
        <p className="text-xs text-muted-foreground">Crea tus tiendas en Configuración › Tiendas.</p>
      </InfoCard>
    );
  }
  return (
    <AjustesCard
      id="store-welcome"
      title="Bienvenida por tienda"
      description="Primer mensaje del chat nuevo según la tienda de la cuenta, con hasta 3 botones de respuesta rápida en WhatsApp. Si la tienda no tiene una activa, se usa la bienvenida general."
      canSave={dirty && !problem}
      saving={m.isPending}
      onSave={() => m.mutate({ welcomeByStore: draft.welcomeByStore.map((w) => ({ ...w, message: w.message.trim(), buttons: w.buttons.map((b) => ({ ...b, text: b.text.trim() })) })) })}
      error={errMsg(m)}
      hint={problem}
    >
      <div role="tablist" aria-label="Tienda" className="flex flex-wrap gap-1">
        {stores.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === storeId}
            onClick={() => setTab(s.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              s.id === storeId ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            Activa en esta tienda
            <Switch aria-label="Bienvenida activa en esta tienda" checked={current.enabled} onCheckedChange={(v) => edit({ enabled: v })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Mensaje
            <Textarea
              aria-label="Mensaje de bienvenida de la tienda"
              value={current.message}
              maxLength={600}
              rows={3}
              onChange={(e) => edit({ message: e.target.value })}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Botones ({current.buttons.length}/{WELCOME_MAX_BUTTONS})</legend>
            {current.buttons.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Texto del botón ${i + 1}`}
                  value={b.text}
                  maxLength={WELCOME_BUTTON_MAX}
                  onChange={(e) => setButton(i, { text: e.target.value })}
                  className="h-9 w-44"
                />
                <span className="w-10 text-[11px] text-muted-foreground">{b.text.length}/{WELCOME_BUTTON_MAX}</span>
                <select
                  aria-label={`Acción del botón ${i + 1}`}
                  value={b.action}
                  onChange={(e) => setButton(i, { action: e.target.value as WelcomeAction })}
                  className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
                >
                  {WELCOME_ACTIONS.map((a) => (
                    <option key={a} value={a}>{WELCOME_ACTION_LABEL[a]}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Quitar botón ${i + 1}`}
                  onClick={() => edit({ buttons: current.buttons.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={current.buttons.length >= WELCOME_MAX_BUTTONS}
              onClick={() => edit({ buttons: [...current.buttons, { text: "", action: "asesora" }] })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar botón
            </Button>
          </fieldset>
        </div>
        <div aria-label="Vista previa" className="space-y-1 rounded-md bg-muted/50 p-3" data-testid="welcome-preview">
          <p className="text-[11px] font-medium text-muted-foreground">Vista previa</p>
          <div className="rounded-md bg-background p-2 text-xs shadow-sm">
            {current.message.trim() || <span className="text-muted-foreground">Escribe el mensaje…</span>}
          </div>
          {current.buttons.map((b, i) => (
            <div key={i} className="rounded-md bg-background p-1.5 text-center text-xs font-medium text-primary shadow-sm">
              {b.text || "…"}
            </div>
          ))}
        </div>
      </div>
    </AjustesCard>
  );
}

// ---------------- J7: atribución ----------------

type AttrDraft = { attributionDays: number; attributionPau: AttributionPau; attributionCod: AttributionCod; attributionReturning: boolean };

export function AttributionCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettingsE();
  const s = asE(settings);
  const server: AttrDraft = {
    attributionDays: s.attributionDays ?? 7,
    attributionPau: s.attributionPau ?? "persona",
    attributionCod: s.attributionCod ?? "confirma",
    attributionReturning: s.attributionReturning ?? true,
  };
  const { draft, setDraft, dirty } = useDraft(server);
  const badDays = !Number.isInteger(draft.attributionDays) || draft.attributionDays < 1 || draft.attributionDays > 30;
  return (
    <AjustesCard
      id="attribution"
      title="A quién se le cuenta la venta"
      description="Reglas para Ventas, Equipo y Difusiones: a quién se atribuye cada venta que sale del chat."
      canSave={dirty && !badDays}
      saving={m.isPending}
      onSave={() => m.mutate(draft)}
      error={errMsg(m)}
      hint={badDays ? "Los días van de 1 a 30." : null}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Días para contar una venta del catálogo o una difusión
          <Input
            type="number"
            min={1}
            max={30}
            aria-label="Días de atribución"
            value={Number.isFinite(draft.attributionDays) ? draft.attributionDays : ""}
            onChange={(e) => setDraft((c) => ({ ...c, attributionDays: Number(e.target.value) }))}
            className="h-9 w-24"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Si Pau inicia y una persona cierra
          <select
            aria-label="Atribución con Pau"
            value={draft.attributionPau}
            onChange={(e) => setDraft((c) => ({ ...c, attributionPau: e.target.value as AttributionPau }))}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="persona">Se cuenta a la persona que cierra</option>
            <option value="inicio">Se cuenta a Pau, que inició</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Pedidos contra entrega
          <select
            aria-label="Atribución contra entrega"
            value={draft.attributionCod}
            onChange={(e) => setDraft((c) => ({ ...c, attributionCod: e.target.value as AttributionCod }))}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="confirma">A quien confirma el pedido</option>
            <option value="tienda">A la tienda (nadie en particular)</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 self-end text-sm">
          Cliente que vuelve: se cuenta a su vendedora
          <Switch
            aria-label="Cliente que vuelve"
            checked={draft.attributionReturning}
            onCheckedChange={(v) => setDraft((c) => ({ ...c, attributionReturning: v }))}
          />
        </label>
      </div>
    </AjustesCard>
  );
}

// ---------------- J10: vendedoras × tiendas ----------------

export function MemberStoresCard({ settings }: { settings: CrmSettings }) {
  const m = useUpdateCrmSettingsE();
  const { stores } = useCrmMe();
  const allIds = stores.map((s) => s.id);
  const server = { memberStores: asE(settings).memberStores ?? [] };
  const { draft, setDraft, dirty } = useDraft(server);
  const { members, people } = usePeople();
  const set = (userId: string, storeId: string, on: boolean) =>
    setDraft((c) => {
      const row = c.memberStores.find((r) => r.userId === userId);
      const cur = row ? row.storeIds : allIds;
      const next = on ? [...new Set([...cur, storeId])] : cur.filter((x) => x !== storeId);
      const rest = c.memberStores.filter((r) => r.userId !== userId);
      // Todas marcadas = sin restricción (se guarda vacío).
      return { memberStores: next.length === allIds.length ? rest : [...rest, { userId, storeIds: allIds.filter((x) => next.includes(x)) }] };
    });
  const empty = draft.memberStores.find((r) => r.storeIds.length === 0 || !r.storeIds.some((x) => allIds.includes(x)));
  return (
    <AjustesCard
      id="member-stores"
      title="Qué tiendas atiende cada persona"
      description="El reparto solo le pasa chats de sus tiendas. Si marcas todas, atiende cualquier tienda."
      canSave={dirty && !empty}
      saving={m.isPending}
      onSave={() => m.mutate({ memberStores: draft.memberStores })}
      error={errMsg(m)}
      hint={empty ? "Cada persona necesita al menos una tienda." : null}
    >
      {members.isLoading && <p className="text-xs text-muted-foreground">Cargando personas…</p>}
      {members.isError && <p role="alert" className="text-xs text-destructive">{crmError(members.error).message}</p>}
      {stores.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no tienes tiendas.</p>
      ) : people.length === 0 ? (
        !members.isLoading && <p className="text-xs text-muted-foreground">Todavía no hay personas con actividad en el CRM.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Persona</th>
                {stores.map((s) => (
                  <th key={s.id} className="px-2 py-1 text-center font-medium">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const own = storesOf(p.userId, draft.memberStores, allIds);
                return (
                  <tr key={p.userId} className="border-t">
                    <td className="py-1.5 pr-3">{p.userName}</td>
                    {stores.map((s) => {
                      const row = draft.memberStores.find((r) => r.userId === p.userId);
                      const on = row ? row.storeIds.includes(s.id) : own.includes(s.id);
                      return (
                        <td key={s.id} className="px-2 py-1.5 text-center">
                          <Checkbox
                            checked={on}
                            onCheckedChange={(v) => set(p.userId, s.id, v === true)}
                            aria-label={`${p.userName} atiende ${s.name}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AjustesCard>
  );
}
