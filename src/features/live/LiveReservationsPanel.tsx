"use client";

import { Link2, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type LiveReservationGroup,
  type LiveReservationTab,
  groupReservations,
} from "./liveGroups";
import { LIVE_PAYMENTS_HREF, liveMoney } from "./liveService";
import {
  LiveEmpty,
  LiveFieldError,
  LivePanel,
  LiveReservationTimer,
} from "./LiveShared";
import type { LiveConsoleData, LiveReservation } from "./types";

const TABS: {
  tab: LiveReservationTab;
  label: string;
  banner: string;
  empty: string;
}[] = [
  {
    tab: "TIMED",
    label: "Con tiempo",
    banner:
      "Cada cliente tiene un solo pedido con un solo reloj. «Link de pago» le reenvía el link por WhatsApp.",
    empty: "No hay apartados con tiempo.",
  },
  {
    tab: "TRUSTED",
    label: "Separado sin pagar",
    banner:
      "Los clientes de confianza separan sin pagar y sin vencimiento. Cada cliente conserva su propio grupo de apartados. Cuando decidas, envíales un solo link de pago.",
    empty: "Nadie está separando sin pagar ahora.",
  },
  {
    tab: "REVIEW",
    label: "Pago por validar",
    banner:
      "Ya enviaron su comprobante Yape. El stock sigue reservado hasta que se valide. Se validan en Finanzas › Pagos por validar (un solo lugar) o desde el botón $ del pedido en Ventas.",
    empty: "No hay pagos por validar. ✓",
  },
  {
    tab: "PAID",
    label: "Pagados",
    banner:
      "Apartados con el pago validado. Siguen su camino en Ventas y Operaciones como cualquier venta.",
    empty: "Aún no hay apartados pagados.",
  },
];

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();

/** FEAT-33 D3: celular peruano (con o sin +51) o internacional con +. */
export function trustedPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const peru = /^(?:51)?(9\d{8})$/.exec(digits)?.[1];
  if (peru) return peru;
  return raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15
    ? `+${digits}`
    : null;
}

/**
 * FEAT-33 A3: Apartados con pestañas y su número. «Con tiempo» es la primera: ahí cae lo que
 * se separa en el catálogo. Una tarjeta por cliente, con un solo reloj.
 */
export default function LiveReservationsPanel({
  data,
  canManage,
  canOperate,
  busy,
  onRelease,
  onTrust,
  onTrustPhone,
  onPaymentLink,
}: {
  data: LiveConsoleData;
  canManage: boolean;
  canOperate: boolean;
  busy: boolean;
  onRelease: (items: LiveReservation[]) => void;
  onTrust: (customerId: string, remove?: boolean) => void;
  onTrustPhone: (input: { name: string; phone: string }) => Promise<boolean>;
  onPaymentLink: (item: LiveReservation) => void;
}) {
  const [tab, setTab] = useState<LiveReservationTab>("TIMED");
  const byTab = Object.fromEntries(
    TABS.map(({ tab: key }) => [
      key,
      groupReservations(data.reservations, key),
    ]),
  ) as Record<LiveReservationTab, LiveReservationGroup[]>;
  const current = TABS.find((item) => item.tab === tab)!;
  const trustedIds = new Set(
    data.trustedCustomers.map((customer) => customer.id),
  );
  const itemName = (item: LiveReservation) =>
    item.productName ||
    item.name ||
    data.products.find((product) => product.variantId === item.variantId)
      ?.name ||
    "Producto";

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Apartados"
        className="flex flex-wrap gap-2"
      >
        {TABS.map(({ tab: key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium ${
              tab === key
                ? "border-teal-700 bg-teal-700 text-white"
                : "bg-background"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-xs ${tab === key ? "bg-white/25" : "bg-black/5"}`}
            >
              {byTab[key].length}
            </span>
          </button>
        ))}
      </div>
      <p
        className={`rounded-xl p-4 text-sm ${
          tab === "REVIEW"
            ? "border border-amber-200 bg-amber-50 text-amber-900"
            : "bg-teal-50 text-teal-900"
        }`}
      >
        {current.banner}
      </p>
      <div role="tabpanel" aria-label={current.label} className="space-y-4">
        {byTab[tab].length ? (
          byTab[tab].map((group) => {
            const headingId = `live-reservation-${group.key}`;
            const releasable = group.items.filter((item) => !item.checkoutId);
            const linkTarget =
              group.items.find((item) => item.status === "ACTIVE") ??
              group.items[0];
            return (
              <article
                key={group.key}
                aria-labelledby={headingId}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 id={headingId} className="text-base font-semibold">
                      {group.customer.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {group.customer.phone} · {group.units}{" "}
                      {group.units === 1 ? "unidad" : "unidades"} ·{" "}
                      {group.items[0].ownerId
                        ? "Live de vendedor"
                        : "Live del negocio"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tab === "TIMED" && group.timer ? (
                      <LiveReservationTimer
                        reservation={group.timer}
                        serverNow={data.serverNow}
                      />
                    ) : tab === "TRUSTED" ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                        ⭐ Acumula
                      </span>
                    ) : tab === "REVIEW" ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Comprobante en revisión
                      </span>
                    ) : tab === "PAID" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        Pagado
                      </span>
                    ) : null}
                    <p className="text-lg font-bold tabular-nums">
                      {liveMoney(group.total)}
                    </p>
                  </div>
                </div>
                <ul className="my-3 divide-y text-sm">
                  {group.items.map((item) => (
                    <li key={item.id} className="py-2">
                      {item.quantity} × {itemName(item)}
                      {item.variantLabel ? (
                        <span className="ml-1 text-muted-foreground">
                          · {item.variantLabel}
                        </span>
                      ) : null}
                      {item.isGift ? (
                        <span className="ml-1 font-medium text-teal-700">
                          · 🎁 Regalo
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {tab === "TIMED" || tab === "TRUSTED" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!canOperate || busy}
                      onClick={() => onPaymentLink(linkTarget)}
                    >
                      <Link2 className="h-4 w-4" aria-hidden="true" />
                      {tab === "TRUSTED"
                        ? "Enviar link de pago"
                        : "Link de pago"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canOperate || busy || !releasable.length}
                      onClick={() => onRelease(releasable)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Liberar
                    </Button>
                    {tab === "TIMED" &&
                    group.customer.id &&
                    !trustedIds.has(group.customer.id) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canManage || busy}
                        onClick={() => onTrust(group.customer.id as string)}
                      >
                        <Star className="h-4 w-4" aria-hidden="true" />
                        Marcar de confianza
                      </Button>
                    ) : null}
                  </div>
                ) : tab === "REVIEW" ? (
                  <Button size="sm" asChild>
                    <Link href={LIVE_PAYMENTS_HREF}>Validar en Finanzas →</Link>
                  </Button>
                ) : null}
              </article>
            );
          })
        ) : (
          <LiveEmpty>{current.empty}</LiveEmpty>
        )}
        {tab === "TRUSTED" ? (
          <TrustedCustomers
            data={data}
            canManage={canManage}
            busy={busy}
            onTrust={onTrust}
            onTrustPhone={onTrustPhone}
          />
        ) : null}
      </div>
    </div>
  );
}

function TrustedCustomers({
  data,
  canManage,
  busy,
  onTrust,
  onTrustPhone,
}: {
  data: LiveConsoleData;
  canManage: boolean;
  busy: boolean;
  onTrust: (customerId: string, remove?: boolean) => void;
  onTrustPhone: (input: { name: string; phone: string }) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const trustedIds = new Set(
    data.trustedCustomers.map((customer) => customer.id),
  );
  const text = fold(query.trim());
  const digits = query.replace(/\D/g, "");
  const results = text
    ? (data.customers ?? [])
        .filter((customer) => !trustedIds.has(customer.id))
        .filter(
          (customer) =>
            fold(customer.name).includes(text) ||
            (digits.length >= 3 &&
              customer.phone.replace(/\D/g, "").includes(digits)),
        )
        .slice(0, 6)
    : [];
  async function add() {
    const found: typeof errors = {};
    const normalized = trustedPhone(phone);
    if (!name.trim()) found.name = "Escribe su nombre.";
    if (!normalized)
      found.phone =
        "WhatsApp de 9 dígitos que empiece con 9 (o con + y código de país).";
    setErrors(found);
    if (Object.keys(found).length || !normalized) return;
    if (await onTrustPhone({ name: name.trim(), phone: normalized })) {
      setName("");
      setPhone("");
    }
  }
  return (
    <LivePanel
      title="⭐ Clientes de confianza"
      description="Solo ellos separan sin pagar y sin vencimiento. Agrégalos buscando por nombre o WhatsApp."
    >
      {!data.config.allowAccumulation ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Está apagado en Configuración: activa «Clientes de confianza acumulan
          sin vencimiento» para que puedan separar sin pagar.
        </p>
      ) : null}
      {data.trustedCustomers.length ? (
        <ul className="divide-y">
          {data.trustedCustomers.map((customer) => (
            <li key={customer.id} className="flex items-center gap-3 py-3">
              <Star className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">{customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {customer.phone}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Quitar confianza a ${customer.name}`}
                disabled={!canManage || busy}
                onClick={() => onTrust(customer.id, true)}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <LiveEmpty>Aún no hay clientes de confianza.</LiveEmpty>
      )}
      <div className="mt-4 space-y-2">
        <Input
          aria-label="Buscar cliente por nombre o WhatsApp"
          placeholder="Buscar cliente por nombre o WhatsApp"
          className="max-w-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {text ? (
          results.length ? (
            <ul className="max-w-xl divide-y rounded-xl border px-3">
              {results.map((customer) => (
                <li key={customer.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.phone}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    aria-label={`Marcar de confianza a ${customer.name}`}
                    disabled={!canManage || busy}
                    onClick={() => onTrust(customer.id)}
                  >
                    <Star className="h-4 w-4" aria-hidden="true" />
                    Marcar de confianza
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nadie con ese nombre o WhatsApp entró todavía al live. Agrégalo
              abajo con su WhatsApp.
            </p>
          )
        ) : null}
      </div>
      <form
        noValidate
        className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <p className="text-sm font-medium sm:col-span-3">
          ¿Todavía no entró al live? Agrégalo por WhatsApp
        </p>
        <div className="grid gap-1.5 text-sm">
          <label htmlFor="live-trusted-name">Nombre</label>
          <Input
            id="live-trusted-name"
            value={name}
            maxLength={120}
            disabled={!canManage || busy}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={
              errors.name ? "live-trusted-name-error" : undefined
            }
            onChange={(event) => setName(event.target.value)}
          />
          <LiveFieldError id="live-trusted-name-error" message={errors.name} />
        </div>
        <div className="grid gap-1.5 text-sm">
          <label htmlFor="live-trusted-phone">WhatsApp</label>
          <Input
            id="live-trusted-phone"
            inputMode="tel"
            value={phone}
            maxLength={20}
            disabled={!canManage || busy}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={
              errors.phone ? "live-trusted-phone-error" : undefined
            }
            onChange={(event) => setPhone(event.target.value)}
          />
          <LiveFieldError
            id="live-trusted-phone-error"
            message={errors.phone}
          />
        </div>
        <Button type="submit" className="sm:mt-6" disabled={!canManage || busy}>
          ＋ Agregar
        </Button>
      </form>
    </LivePanel>
  );
}
