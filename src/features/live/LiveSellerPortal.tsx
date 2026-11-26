"use client";

import { Loader2, LogOut } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import LiveCopyButton from "./LiveCopyButton";
import { saleRows } from "./LiveSellerSales";
import { LiveFieldError } from "./LiveShared";
import { agreementText } from "./liveCommission";
import { liveLinks } from "./liveLinks";
import { liveError, liveMoney } from "./liveService";
import {
  gainPerUnit,
  portalLinkInfo,
  portalLogin,
  portalLogout,
  portalMe,
  portalProducts,
  portalSales,
  portalSetOnAir,
  portalSetPassword,
  portalStatus,
  readPortalSession,
  savePortalSession,
} from "./liveSellerPortalService";
import type {
  LiveAgreement,
  LiveSellerPortalMe,
  LiveSellerPortalProduct,
  LiveSellerPortalSales,
  LiveSellerPortalSession,
} from "./types";

type Screen =
  | { kind: "loading" }
  | { kind: "login"; notice?: string }
  | { kind: "forgot" }
  | { kind: "setpw"; token: string; name: string; email: string | null; storeName: string; reset: boolean }
  | { kind: "badlink"; message: string }
  | { kind: "portal"; session: string };

const field =
  "min-h-12 w-full rounded-[14px] border-[1.5px] bg-background px-3.5 text-base outline-none focus:border-teal-600 aria-[invalid=true]:border-red-500";
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * FEAT-33 L5b (C3/C4): portal de la creadora en `/vendedor/{tienda}`. Entra con su correo y contraseña (sesión
 * propia, no la de Powip). Ve su link, sus productos, sus ventas (sin datos del cliente) y sus ganancias.
 */
export default function LiveSellerPortal({ slug }: { slug: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  useEffect(() => {
    const token = /(?:^|[#&])t=([A-Za-z0-9_-]{43})(?:&|$)/.exec(window.location.hash)?.[1];
    if (token) {
      // El token sale de la barra de direcciones apenas se lee.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      void portalLinkInfo(slug, token)
        .then((info) =>
          setScreen({
            kind: "setpw",
            token,
            name: info.name,
            email: info.email,
            storeName: info.storeName,
            reset: info.kind === "RESET",
          }),
        )
        .catch((e) => setScreen({ kind: "badlink", message: liveError(e) }));
      return;
    }
    const session = readPortalSession(slug);
    setScreen(session ? { kind: "portal", session } : { kind: "login" });
  }, [slug]);
  const enter = (session: LiveSellerPortalSession) => {
    savePortalSession(slug, session);
    setScreen({ kind: "portal", session: session.token });
  };
  const expire = useCallback(() => {
    savePortalSession(slug, null);
    setScreen({ kind: "login", notice: "Tu sesión terminó. Vuelve a entrar." });
  }, [slug]);

  if (screen.kind === "loading")
    return (
      <Shell>
        <p className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
        </p>
      </Shell>
    );
  if (screen.kind === "portal")
    return (
      <Portal
        slug={slug}
        session={screen.session}
        onExpired={expire}
        onLogout={async () => {
          try {
            await portalLogout(slug, screen.session);
          } catch {
            /* la sesión se olvida igual */
          }
          savePortalSession(slug, null);
          setScreen({ kind: "login" });
        }}
      />
    );
  return (
    <Shell>
      <AuthCard>
        {screen.kind === "login" ? (
          <LoginForm slug={slug} notice={screen.notice} onEnter={enter} onForgot={() => setScreen({ kind: "forgot" })} />
        ) : null}
        {screen.kind === "forgot" ? (
          <div className="grid gap-4">
            <h1 className="text-xl font-bold">Olvidé mi contraseña</h1>
            <p className="text-sm text-muted-foreground">
              Pídele al negocio que te mande un enlace para crear una nueva contraseña. Vence en 1 hora y es de un
              solo uso.
            </p>
            <Button variant="outline" onClick={() => setScreen({ kind: "login" })}>
              Volver al ingreso
            </Button>
          </div>
        ) : null}
        {screen.kind === "badlink" ? (
          <div className="grid gap-4">
            <p role="alert" className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
              {screen.message}
            </p>
            <Button variant="outline" onClick={() => setScreen({ kind: "login" })}>
              Ir al ingreso
            </Button>
          </div>
        ) : null}
        {screen.kind === "setpw" ? <SetPasswordForm slug={slug} screen={screen} onEnter={enter} /> : null}
      </AuthCard>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">{children}</main>;
}
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[420px]">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="mb-5 text-center text-sm text-muted-foreground">Portal de creadoras y vendedores</p>
        {children}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        ¿No tienes acceso? Pídeselo al negocio: ellos crean tu usuario.
      </p>
    </div>
  );
}

function LoginForm({
  slug,
  notice,
  onEnter,
  onForgot,
}: {
  slug: string;
  notice?: string;
  onEnter: (session: LiveSellerPortalSession) => void;
  onForgot: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim() || !password) return setError("Escribe tu correo y tu contraseña.");
        setBusy(true);
        setError("");
        try {
          onEnter(await portalLogin(slug, email.trim(), password));
        } catch (err) {
          setError(liveError(err));
          setPassword("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-xl font-bold">Entrar a mi portal</h1>
      {notice ? <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm">{notice}</p> : null}
      <div className="grid gap-1">
        <label htmlFor={`${id}-email`} className="text-[13px] font-semibold">
          Correo
        </label>
        <input
          id={`${id}-email`}
          className={field}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-password`} className="text-[13px] font-semibold">
          Contraseña
        </label>
        <input
          id={`${id}-password`}
          className={field}
          type="password"
          autoComplete="current-password"
          value={password}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        <LiveFieldError id={`${id}-error`} message={error} />
      </div>
      <Button type="submit" className="min-h-12 bg-teal-700 hover:bg-teal-800" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Entrar
      </Button>
      <button type="button" className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline" onClick={onForgot}>
        Olvidé mi contraseña
      </button>
    </form>
  );
}

function SetPasswordForm({
  slug,
  screen,
  onEnter,
}: {
  slug: string;
  screen: Extract<Screen, { kind: "setpw" }>;
  onEnter: (session: LiveSellerPortalSession) => void;
}) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setError("La contraseña tiene al menos 8 caracteres.");
        if (!/\p{L}/u.test(password) || !/\d/.test(password)) return setError("Usa al menos una letra y un número.");
        if (password !== repeat) return setError("Las contraseñas no coinciden.");
        setBusy(true);
        setError("");
        try {
          onEnter(await portalSetPassword(slug, screen.token, password));
        } catch (err) {
          setError(liveError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-bold">
          Hola {first(screen.name)}, {screen.reset ? "crea una nueva contraseña" : "crea tu contraseña"}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {screen.storeName} · Tu usuario: {screen.email}
        </p>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-pw`} className="text-[13px] font-semibold">
          Contraseña nueva
        </label>
        <input
          id={`${id}-pw`}
          className={field}
          type="password"
          autoComplete="new-password"
          value={password}
          aria-describedby={`${id}-hint`}
          onChange={(e) => setPassword(e.target.value)}
        />
        <small id={`${id}-hint`} className="text-xs text-muted-foreground">
          Mínimo 8 caracteres, con letras y al menos un número.
        </small>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-pw2`} className="text-[13px] font-semibold">
          Repite la contraseña
        </label>
        <input
          id={`${id}-pw2`}
          className={field}
          type="password"
          autoComplete="new-password"
          value={repeat}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setRepeat(e.target.value)}
        />
        <LiveFieldError id={`${id}-error`} message={error} />
      </div>
      <Button type="submit" className="min-h-12 bg-teal-700 hover:bg-teal-800" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Guardar y entrar
      </Button>
    </form>
  );
}

/** «14:30» en hora de Lima. */
function limaTime(iso: string) {
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  }).format(new Date(iso));
}

type Tab = "today" | "products" | "sales" | "earnings";
const TABS: [Tab, string][] = [
  ["today", "Hoy"],
  ["products", "Mis productos"],
  ["sales", "Mis ventas"],
  ["earnings", "Mis ganancias"],
];

function Portal({
  slug,
  session,
  onExpired,
  onLogout,
}: {
  slug: string;
  session: string;
  onExpired: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const [me, setMe] = useState<LiveSellerPortalMe | null>(null);
  const [products, setProducts] = useState<{ agreement: LiveAgreement; products: LiveSellerPortalProduct[] } | null>(null);
  const [sales, setSales] = useState<LiveSellerPortalSales | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const fail = useCallback(
    (e: unknown) => {
      if (portalStatus(e) === 401) onExpired();
      else setError(liveError(e));
    },
    [onExpired],
  );
  useEffect(() => {
    void portalMe(slug, session).then(setMe, fail);
  }, [slug, session, fail]);
  useEffect(() => {
    if (tab === "products" && !products) void portalProducts(slug, session).then(setProducts, fail);
    if (tab === "sales" && !sales) void portalSales(slug, session).then(setSales, fail);
  }, [tab, slug, session, products, sales, fail]);
  const link = useMemo(
    () =>
      me && typeof window !== "undefined"
        ? liveLinks({ origin: window.location.origin, slug: me.store.slug }).advisorUrl(me.seller.code)
        : "",
    [me],
  );
  if (!me)
    return (
      <Shell>
        {error ? (
          <p role="alert" className="mx-auto max-w-md rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        ) : (
          <p className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando tu portal…
          </p>
        )}
      </Shell>
    );
  const s = me.stats;
  const onAir = !!me.seller.onAir;
  // C5: «Estoy en vivo» / «Terminar live».
  async function toggleLive() {
    if (switching) return;
    setSwitching(true);
    setError("");
    try {
      const next = await portalSetOnAir(slug, session, !onAir);
      setMe((current) => (current ? { ...current, seller: { ...current.seller, ...next } } : current));
    } catch (e) {
      fail(e);
    } finally {
      setSwitching(false);
    }
  }
  return (
    <Shell>
      <div className="mx-auto grid max-w-4xl gap-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-teal-700 font-bold text-white" aria-hidden="true">
            {initials(me.seller.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">Hola, {first(me.seller.name)}</h1>
            <p className="text-sm text-muted-foreground">
              Portal de la creadora · {me.store.name}
              {me.seller.social ? ` · ${me.seller.social}` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </header>
        <div role="tablist" aria-label="Secciones del portal" className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 aria-selected:bg-teal-700 aria-selected:text-white"
            >
              {label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {tab === "today" ? (
          <>
            <section
              aria-label="Tu live"
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-5 shadow-sm"
            >
              <span
                aria-hidden="true"
                className={`h-3 w-3 shrink-0 rounded-full ${onAir ? "bg-red-500 motion-safe:animate-pulse" : "bg-slate-400"}`}
              />
              <div className="min-w-[200px] flex-1">
                <b className="block text-[17px]">{onAir ? "Estás en vivo" : "No estás en vivo"}</b>
                <small className="block text-muted-foreground">
                  {onAir
                    ? `Tu catálogo muestra los precios del live del negocio${
                        me.seller.onAirUntil ? ` · se apaga solo a las ${limaTime(me.seller.onAirUntil)}` : ""
                      }`
                    : "Tu link sigue abierto con precios normales"}
                </small>
              </div>
              <Button variant={onAir ? "outline" : "default"} disabled={switching} onClick={() => void toggleLive()}>
                {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {onAir ? "⏹ Terminar live" : "🔴 Estoy en vivo"}
              </Button>
              <Button variant="outline" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  Ver mi catálogo ↗
                </a>
              </Button>
            </section>
            <section className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Tu link para vender</h2>
              <p className="break-all rounded-xl bg-slate-100 px-3 py-2 text-sm">🔗 {link}</p>
              <div className="flex flex-wrap gap-2">
                <LiveCopyButton text={link} label="Copiar link" size="default" variant="default" />
                <LiveCopyButton
                  text={`Compra lo que muestro en el live aquí: ${link}`}
                  label="Copiar comentario"
                  size="default"
                />
              </div>
            </section>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Vendiste hoy" value={String(me.today.units)} hint={`prendas en ${me.today.orders} pedido${me.today.orders === 1 ? "" : "s"}`} />
              <Kpi label="Ganancia confirmada" value={liveMoney(s.earned)} hint="de pagos validados" tone="text-teal-700" />
              <Kpi label="Por confirmar" value={liveMoney(s.pendingConfirmation)} hint="cuando el negocio valide los pagos" tone="text-amber-700" />
              <Kpi label="Por cobrar" value={liveMoney(s.toPay)} hint="lo que el negocio te debe" />
            </div>
          </>
        ) : null}
        {tab === "products" ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Productos que puedes vender</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Los habilita {me.store.name}. El stock y los precios son los mismos del negocio y se actualizan solos.
            </p>
            {!products ? (
              <Loading />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-3 font-medium">Producto</th>
                      <th className="py-2 pr-3 font-medium">Tienda</th>
                      <th className="py-2 pr-3 font-medium">Precio live</th>
                      <th className="py-2 pr-3 text-right font-medium">Disponible</th>
                      <th className="py-2 text-right font-medium">Tu ganancia por unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.products.length ? (
                      products.products.map((p) => (
                        <tr key={p.productId} className="border-b last:border-0">
                          <td className="py-3 pr-3 font-medium">{p.name}</td>
                          <td className="py-3 pr-3 tabular-nums">{liveMoney(p.regularPrice)}</td>
                          <td className="py-3 pr-3 font-semibold tabular-nums text-red-600">{liveMoney(p.livePrice)}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">{p.available}</td>
                          <td className="py-3 text-right font-semibold tabular-nums">
                            {liveMoney(gainPerUnit(products.agreement, p))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-muted-foreground">
                          Todavía no tienes productos habilitados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Tu acuerdo: {agreementText(me.seller.agreement)}. Si necesitas otro producto, pídeselo al negocio.
            </p>
          </section>
        ) : null}
        {tab === "sales" ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Mis ventas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lo que se vendió con tu link. No ves teléfono, dirección ni DNI del cliente.
            </p>
            {!sales ? <Loading /> : <SalesTable sales={sales} />}
          </section>
        ) : null}
        {tab === "earnings" ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Mis ganancias</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acuerdo con {me.store.name}: <b>{agreementText(me.seller.agreement)}</b>. Se calcula con pagos validados
              y sin envío; si un pedido se anula o se devuelve, se descuenta.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Confirmada" value={liveMoney(s.earned)} tone="text-teal-700" />
              <Kpi label="Por confirmar" value={liveMoney(s.pendingConfirmation)} tone="text-amber-700" />
              <Kpi label="Ya te pagaron" value={liveMoney(s.paid)} />
              <Kpi
                label="Por cobrar"
                value={liveMoney(s.toPay)}
                hint={me.lastPayoutAt ? `último pago: ${new Date(me.lastPayoutAt).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}` : undefined}
              />
            </div>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}

function Loading() {
  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
    </p>
  );
}

function Kpi({ label, value, hint, tone = "" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const STATE = {
  CONFIRMED: { label: "Validado", className: "bg-emerald-100 text-emerald-800" },
  PENDING: { label: "Por confirmar", className: "bg-amber-100 text-amber-800" },
  VOID: { label: "Anulado", className: "bg-slate-100 text-slate-600" },
} as const;

function SalesTable({ sales }: { sales: LiveSellerPortalSales }) {
  const rows = saleRows(sales.lines);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Pedido</th>
            <th className="py-2 pr-3 font-medium">Cliente</th>
            <th className="py-2 pr-3 text-right font-medium">Prendas</th>
            <th className="py-2 pr-3 text-right font-medium">Venta</th>
            <th className="py-2 pr-3 font-medium">Pago</th>
            <th className="py-2 text-right font-medium">Tu ganancia</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.orderId} className="border-b last:border-0">
                <td className="py-3 pr-3">
                  {new Date(row.createdAt).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}
                </td>
                <td className="py-3 pr-3 font-medium">{row.orderNumber}</td>
                <td className="py-3 pr-3">{row.customer}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{row.units}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{liveMoney(row.sale)}</td>
                <td className="py-3 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE[row.state].className}`}>
                    {STATE[row.state].label}
                  </span>
                </td>
                <td className="py-3 text-right tabular-nums">
                  <b>{liveMoney(row.commission)}</b>
                  {row.state === "PENDING" ? <small className="block text-muted-foreground">por confirmar</small> : null}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="py-4 text-muted-foreground">
                Aún no tienes ventas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
