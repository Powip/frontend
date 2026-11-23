"use client";
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmMe } from "@/hooks/useCrmMe";
import {
  useChannelAccounts,
  useCrmPlan,
  useDisconnectChannelAccount,
  useReconnectChannelAccount,
  useUpdateChannelAccount,
  useUpdateCrmPlan,
} from "@/hooks/useCrmPlan";
import type { ChannelAccount, CrmAccountType } from "@/services/crmPlanService";
import { NATIVE_SELECT_CLASS } from "./format";

const soles = (value: number) => `S/ ${Number.isInteger(value) ? value : value.toFixed(2)}`;

function Section({ id, title, description, children }: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3 rounded-md border bg-card p-4" data-testid={`card-${id}`}>
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PlanBox({ title, price, detail, active, testId }: {
  title: string;
  price: string;
  detail: string;
  active: boolean;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      aria-current={active ? "true" : undefined}
      className={cn("rounded-md border p-3", active && "border-primary bg-primary/5")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {active && (
          <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
            Tu plan
          </span>
        )}
      </div>
      <p className="text-lg font-semibold tabular-nums">
        {price} <span className="text-xs font-normal text-muted-foreground">/ mes</span>
      </p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

/**
 * «Plan y vendedoras»: CRM + Pau o solo CRM, asientos incluidos y tipo de cuenta
 * (Core + CRM en app.powip.lat o Solo CRM en crm.powip.lat). Precios del .env de ms-crm;
 * aquí no se cobra nada.
 */
export function PlanCard() {
  const plan = useCrmPlan();
  const update = useUpdateCrmPlan();

  if (plan.isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando plan…
      </p>
    );
  }
  if (plan.isError || !plan.data) {
    return (
      <p role="alert" className="text-sm text-destructive" data-testid="card-crm-plan">
        {crmError(plan.error).message}
      </p>
    );
  }
  const q = plan.data;
  const overSeats = q.seats.used > q.seats.included;
  const setType = (accountType: CrmAccountType) => {
    if (accountType !== q.accountType) update.mutate({ accountType });
  };

  return (
    <Section
      id="crm-plan"
      title="Plan y vendedoras"
      description="Elige si tu equipo usa a Pau. Sin Pau, el CRM sigue igual y Pau queda apagado."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <PlanBox
          testId="plan-bundle"
          title="CRM + Pau"
          price={soles(q.prices.bundle)}
          detail={q.bundleSavings > 0 ? `Ahorras ${soles(q.bundleSavings)} frente a comprarlos por separado` : "CRM y Pau juntos"}
          active={q.pauOn}
        />
        <PlanBox
          testId="plan-crm"
          title="Solo CRM"
          price={soles(q.prices.crm)}
          detail={`Pau se agrega luego por ${soles(q.prices.pau)} al mes`}
          active={!q.pauOn}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Vendedoras</span>
          <span className="tabular-nums" data-testid="plan-seats">
            {q.seats.used} / {q.seats.included} incluidas
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-muted" aria-hidden="true">
          <div
            className={cn("h-full", overSeats ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${Math.min(100, q.seats.included ? (q.seats.used / q.seats.included) * 100 : 100)}%` }}
          />
        </div>
        {q.seats.extra > 0 && (
          <p className="text-[11px] text-amber-700">
            {q.seats.extra} vendedora{q.seats.extra === 1 ? "" : "s"} extra × {soles(q.prices.extraSeat)}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span>Total al mes</span>
        <span className="font-semibold tabular-nums" data-testid="plan-total">{soles(q.monthlyTotal)}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Tipo de cuenta</p>
        <div role="radiogroup" aria-label="Tipo de cuenta" className="inline-flex rounded-md border p-0.5">
          {(
            [
              ["core", "Core + CRM"],
              ["solo", "Solo CRM"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={q.accountType === value}
              disabled={update.isPending}
              onClick={() => setType(value)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                q.accountType === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground" data-testid="plan-domain">
          Entras por {q.domain}
          {q.accountType === "solo" ? " · solo el CRM de ventas por chat" : " · con todos los módulos de POWIP"}
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant={q.pauOn ? "outline" : "default"}
          disabled={update.isPending}
          onClick={() => update.mutate({ pauOn: !q.pauOn })}
        >
          {update.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          {q.pauOn ? "Cambiar a solo CRM" : `Agregar Pau · ${soles(q.prices.pau)}`}
        </Button>
      </div>
    </Section>
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  tiktok: "TikTok",
};

function AccountRow({ account }: { account: ChannelAccount }) {
  const { stores } = useCrmMe();
  const update = useUpdateChannelAccount();
  const disconnect = useDisconnectChannelAccount();
  const reconnect = useReconnectChannelAccount();
  const [name, setName] = useState(account.name ?? "");
  const [storeId, setStoreId] = useState(account.storeId ?? "");
  const dirty = name.trim() !== (account.name ?? "") || storeId !== (account.storeId ?? "");
  const busy = update.isPending || disconnect.isPending || reconnect.isPending;
  const label = account.name || account.accountId;

  return (
    <li className="space-y-2 rounded-md border p-3" data-testid={`channel-account-${account.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{CHANNEL_LABEL[account.channel] ?? account.channel}</span>
        <span className="text-muted-foreground">{account.accountId}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium",
            account.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
          )}
        >
          {account.isActive ? "Conectada" : "Desconectada"}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Nombre
          <Input
            aria-label={`Nombre de ${label}`}
            value={name}
            maxLength={160}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-48"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Tienda
          <select
            aria-label={`Tienda de ${label}`}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
          >
            <option value="">Sin tienda</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          {account.isActive ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => disconnect.mutate(account)}>
              Desconectar
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => reconnect.mutate(account)}>
              Reconectar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!dirty || busy || !name.trim()}
            onClick={() =>
              update.mutate({ id: account.id, input: { name: name.trim(), storeId: storeId || null } })
            }
          >
            {update.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </li>
  );
}

/**
 * «Cuentas conectadas»: números y páginas por los que entran los chats. Cambiar la tienda
 * mueve sus chats a esa tienda. No se desconecta una cuenta con chats abiertos.
 */
export function ChannelAccountsCard() {
  const accounts = useChannelAccounts();
  const rows = accounts.data ?? [];
  return (
    <Section
      id="channel-accounts"
      title="Cuentas conectadas"
      description="Ponle nombre a cada número o página y elige su tienda. Sus chats pasan a esa tienda."
    >
      {accounts.isLoading ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando cuentas…
        </p>
      ) : accounts.isError ? (
        <p role="alert" className="text-xs text-destructive">{crmError(accounts.error).message}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay cuentas. Aparecen cuando entra el primer mensaje por un número o página.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <AccountRow key={`${a.id}-${a.name ?? ""}-${a.storeId ?? ""}`} account={a} />
          ))}
        </ul>
      )}
    </Section>
  );
}
