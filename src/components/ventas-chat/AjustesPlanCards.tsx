"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmMe } from "@/hooks/useCrmMe";
import {
  useChannelAccounts,
  useCrmAccess,
  useCrmPlan,
  useDisconnectChannelAccount,
  useReconnectChannelAccount,
  useUpdateChannelAccount,
} from "@/hooks/useCrmPlan";
import type { ChannelAccount } from "@/services/crmPlanService";
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

const fecha = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/**
 * «Plan y vendedoras»: solo lectura. El plan (CRM o CRM + Pau) sale del pago confirmado en
 * ms-subscription; aquí no se elige ni se cambia. Para contratar o cambiar: Configuración › Mi plan.
 */
export function PlanCard() {
  const plan = useCrmPlan();
  const access = useCrmAccess();

  if (plan.isLoading || access.isLoading) {
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
  const a = access.data;
  const overSeats = q.seats.used > q.seats.included;
  const paidName = a?.pau ? "CRM + Pau" : a?.crm ? "Solo CRM" : "Sin plan activo";

  return (
    <Section
      id="crm-plan"
      title="Plan y vendedoras"
      description="Tu plan sale de lo que pagaste. Para agregar Pau o cambiar de plan, ve a Mi plan."
    >
      <div className="flex items-center justify-between rounded-md border px-3 py-2" data-testid="plan-paid">
        <div>
          <p className="text-sm font-medium">{paidName}</p>
          {a?.until && (
            <p className="text-[11px] text-muted-foreground">
              {a.via === "MANUAL" ? "Activado por POWIP" : "Pagado"} hasta el {fecha(a.until)}
            </p>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/configuracion/plan">Ver Mi plan</Link>
        </Button>
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
            disabled={!dirty || busy}
            onClick={() =>
              update.mutate({
                id: account.id,
                input: { ...(name.trim() ? { name: name.trim() } : {}), storeId: storeId || null },
              })
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
  const noStore = rows.filter((a) => a.isActive && !a.storeId).length;
  return (
    <Section
      id="channel-accounts"
      title="Cuentas conectadas"
      description="Ponle nombre a cada número o página y elige su tienda. Sus chats pasan a esa tienda."
    >
      {noStore > 0 && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {noStore === 1 ? "1 cuenta sin tienda" : `${noStore} cuentas sin tienda`}: las ventas de sus chats no crean
          pedido en Powip. Elige la tienda y guarda.
        </p>
      )}
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
