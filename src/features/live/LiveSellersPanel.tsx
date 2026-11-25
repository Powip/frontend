"use client";

import { Loader2, Plus, Settings2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LiveAgreementEditor, { agreementDraft, draftAgreement, type AgreementDraft } from "./LiveAgreementEditor";
import LiveCopyButton from "./LiveCopyButton";
import LiveSellerAccessCard, { IssuedLinkDialog, type IssuedLink } from "./LiveSellerAccessCard";
import LiveSellerSalesView from "./LiveSellerSales";
import { LiveEmpty, LiveErrorBanner, LiveFieldError, LivePanel, LiveSaveState } from "./LiveShared";
import { agreementError, agreementText } from "./liveCommission";
import { groupLiveProducts } from "./liveGroups";
import type { LiveLinks } from "./liveLinks";
import {
  createLiveSeller,
  getLiveSellers,
  issueLiveSellerLink,
  liveError,
  liveMoney,
  updateLiveSellerAgreement,
  updateLiveSellerProducts,
  updateLiveSuggestedAgreement,
} from "./liveService";
import type { LiveProduct, LiveSeller, LiveSellersData } from "./types";

/** Producto del live que se puede habilitar para una creadora (C2: por producto, no por variante). */
export interface SellerProductOption {
  productId: string;
  name: string;
  regularPrice: number;
  livePrice: number;
  stock: number;
}
export function sellerProductOptions(products: LiveProduct[]): SellerProductOption[] {
  return groupLiveProducts(products.filter((p) => p.productId && p.enabled)).map((group) => ({
    productId: group.key,
    name: group.name,
    regularPrice: group.regularPrice,
    livePrice: Math.min(...group.variants.map((v) => v.livePrice)),
    stock: group.totalStock,
  }));
}

type InviteState = { advisor?: { id: string; name: string; code: string } };

/**
 * FEAT-33 L5a (C1/C2): «Vendedores y comisiones». Cada creadora tiene su link (`?a=CÓDIGO`), su acuerdo
 * de comisión y los productos que puede vender. La comisión cuenta solo pagos validados y sin envío.
 */
export default function LiveSellersPanel({
  storeId,
  storeName = "La tienda",
  products,
  links,
  canManage,
}: {
  storeId: string;
  storeName?: string;
  products: LiveProduct[];
  links: LiveLinks;
  canManage: boolean;
}) {
  const [data, setData] = useState<LiveSellersData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [agreementFor, setAgreementFor] = useState<LiveSeller | null>(null);
  const [productsFor, setProductsFor] = useState<LiveSeller | null>(null);
  const [invite, setInvite] = useState<InviteState | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const options = useMemo(() => sellerProductOptions(products), [products]);
  const example = options[0] ?? null;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getLiveSellers(storeId));
      setError("");
    } catch (e) {
      setError(liveError(e));
    } finally {
      setLoading(false);
    }
  }, [storeId]);
  useEffect(() => {
    void load();
  }, [load]);
  const replace = (seller: LiveSeller) =>
    setData((current) =>
      current
        ? {
            ...current,
            // Las respuestas de editar no traen el acceso: se conserva el que había.
            sellers: current.sellers.map((s) => (s.id === seller.id ? { ...seller, access: seller.access ?? s.access } : s)),
          }
        : current,
    );
  const patch = (sellerId: string, changes: Partial<LiveSeller>) =>
    setData((current) =>
      current
        ? { ...current, sellers: current.sellers.map((s) => (s.id === sellerId ? { ...s, ...changes } : s)) }
        : current,
    );

  if (!data)
    return loading ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando vendedores…
      </p>
    ) : (
      <LiveErrorBanner message={error || "No pudimos cargar los vendedores."} onRetry={() => void load()} />
    );

  const sellers = data.sellers.filter((s) => s.status === "ACTIVE");
  const current = selected ? data.sellers.find((s) => s.id === selected) : null;
  if (current)
    return (
      <>
        <LiveSellerSalesView
          storeId={storeId}
          seller={current}
          link={links.advisorUrl(current.code)}
          canManage={canManage}
          onBack={() => {
            setSelected(null);
            void load();
          }}
          onAgreement={() => setAgreementFor(current)}
          onChanged={replace}
        />
        {agreementFor ? (
          <AgreementDialog
            storeId={storeId}
            seller={agreementFor}
            product={example}
            onClose={() => setAgreementFor(null)}
            onSaved={(seller) => {
              replace(seller);
              setAgreementFor(null);
            }}
          />
        ) : null}
      </>
    );

  const k = data.kpis;
  return (
    <div className="space-y-5">
      {error ? <LiveErrorBanner message={error} onRetry={() => void load()} /> : null}
      <p className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        Aquí ves lo que venden tus creadoras de contenido y vendedores por comisión. Cada venta entra a{" "}
        <b>Ventas</b> con su nombre en Vendedor. La comisión se calcula solo con pagos validados y sin el envío; si
        un pedido se anula o se devuelve, se descuenta.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="seller-kpis">
        <Kpi label="Ventas validadas de vendedores" value={liveMoney(k.sales)} hint="sin envío" tone="text-teal-700" />
        <Kpi label="Comisión ganada" value={liveMoney(k.earned)} hint="de pagos validados" />
        <Kpi
          label="Por pagar"
          value={liveMoney(k.toPay)}
          hint={`${liveMoney(k.pendingConfirmation)} más cuando se validen sus pagos`}
          tone="text-amber-700"
        />
        <Kpi
          label="Vendedores por comisión"
          value={String(k.sellers)}
          hint={`de ${k.sellers + data.advisors.length} con link`}
        />
      </div>
      <LivePanel
        title="Tus vendedores y creadoras"
        description='Toca "Ver ventas" para ver cada pedido y su comisión. "Productos" define lo que cada creadora puede vender.'
        aside={
          canManage ? (
            <Button onClick={() => setInvite({})}>
              <Plus className="h-4 w-4" /> Invitar creadora o vendedor
            </Button>
          ) : null
        }
      >
        {sellers.length || data.advisors.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm" aria-label="Vendedores y su comisión">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Vendedor</th>
                  <th className="py-2 pr-3 font-medium">Link</th>
                  <th className="py-2 pr-3 font-medium">Comisión</th>
                  <th className="py-2 pr-3 text-right font-medium">Pedidos</th>
                  <th className="py-2 pr-3 text-right font-medium">Prendas</th>
                  <th className="py-2 pr-3 text-right font-medium">Ventas validadas</th>
                  <th className="py-2 pr-3 text-right font-medium">Comisión ganada</th>
                  <th className="py-2 pr-3 text-right font-medium">Por pagar</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => (
                  <tr key={seller.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <b className="font-semibold">{seller.name}</b>
                      {seller.onAir ? (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          🔴 En vivo
                        </span>
                      ) : null}
                      {seller.social ? <small className="block text-muted-foreground">{seller.social}</small> : null}
                    </td>
                    <td className="py-3 pr-3">
                      <LiveCopyButton text={links.advisorUrl(seller.code)} label="Copiar link" />
                    </td>
                    <td className="py-3 pr-3">
                      <b className="font-medium">Acuerdo propio</b>
                      <small className="block text-muted-foreground">{agreementText(seller.agreement, true)}</small>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">{seller.stats.orders}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{seller.stats.units}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{liveMoney(seller.stats.sales)}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">{liveMoney(seller.stats.earned)}</td>
                    <td className="py-3 pr-3 text-right font-semibold tabular-nums text-amber-800">
                      {liveMoney(seller.stats.toPay)}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(seller.id)}>
                          Ver ventas
                        </Button>
                        {canManage ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setProductsFor(seller)}>
                              Productos ({seller.productIds.length})
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Acuerdo de comisión de ${seller.name}`}
                              onClick={() => setAgreementFor(seller)}
                            >
                              <Settings2 className="h-4 w-4" /> Acuerdo
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.advisors.map((advisor) => (
                  <tr key={advisor.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <b className="font-semibold">{advisor.name}</b>
                      <small className="block text-muted-foreground">Asesora</small>
                    </td>
                    <td className="py-3 pr-3">
                      <LiveCopyButton text={links.advisorUrl(advisor.code)} label="Copiar link" />
                    </td>
                    <td className="py-3 pr-3">
                      <small className="text-muted-foreground">Sin comisión (asesora)</small>
                    </td>
                    <td colSpan={5} className="py-3 pr-3 text-right text-muted-foreground">
                      —
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        {canManage ? (
                          <Button size="sm" variant="outline" onClick={() => setInvite({ advisor })}>
                            Pasar a comisión
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LiveEmpty>
            Todavía no tienes creadoras ni vendedores por comisión. Invita a la primera con su correo y su acuerdo.
          </LiveEmpty>
        )}
      </LivePanel>
      {canManage && sellers.length ? (
        <LiveSellerAccessCard
          storeId={storeId}
          sellers={sellers}
          links={links}
          onChanged={patch}
          onIssued={setIssued}
        />
      ) : null}
      <SuggestedAgreement
        key={JSON.stringify(data.suggestedAgreement)}
        storeId={storeId}
        value={data.suggestedAgreement}
        product={example}
        disabled={!canManage}
        onSaved={(suggestedAgreement) => setData((d) => (d ? { ...d, suggestedAgreement } : d))}
      />
      {agreementFor ? (
        <AgreementDialog
          storeId={storeId}
          seller={agreementFor}
          product={example}
          onClose={() => setAgreementFor(null)}
          onSaved={(seller) => {
            replace(seller);
            setAgreementFor(null);
          }}
        />
      ) : null}
      {productsFor ? (
        <ProductsDialog
          storeId={storeId}
          seller={productsFor}
          options={options}
          onClose={() => setProductsFor(null)}
          onSaved={(seller) => {
            replace(seller);
            setProductsFor(null);
          }}
        />
      ) : null}
      {issued ? <IssuedLinkDialog link={issued} storeName={storeName} onClose={() => setIssued(null)} /> : null}
      {invite ? (
        <InviteDialog
          storeId={storeId}
          advisor={invite.advisor}
          suggested={data.suggestedAgreement}
          options={options}
          links={links}
          onClose={() => setInvite(null)}
          onCreated={async (seller) => {
            setInvite(null);
            toast.success(
              invite.advisor
                ? `${seller.name} ahora vende por comisión · revisa su acuerdo en ⚙ Acuerdo`
                : `${seller.name} ya tiene su link`,
            );
            // L5b: con correo, se genera su invitación al portal para mandársela.
            if (seller.email && links.portalUrl)
              try {
                const link = await issueLiveSellerLink(storeId, seller.id, "invite");
                setIssued({ seller, kind: link.kind, url: links.portalAccessUrl(link.token), expiresAt: link.expiresAt });
              } catch (e) {
                toast.error(liveError(e));
              }
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint, tone = "" }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SuggestedAgreement({
  storeId,
  value,
  product,
  disabled,
  onSaved,
}: {
  storeId: string;
  value: LiveSellersData["suggestedAgreement"];
  product: SellerProductOption | null;
  disabled: boolean;
  onSaved: (agreement: LiveSellersData["suggestedAgreement"]) => void;
}) {
  const initial = useMemo(() => agreementDraft(value), [value]);
  const [draft, setDraft] = useState<AgreementDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirty = JSON.stringify(draftAgreement(draft)) !== JSON.stringify(draftAgreement(initial));
  const invalid = !!agreementError(draftAgreement(draft));
  return (
    <LivePanel
      title="Comisión sugerida al invitar"
      description="La comisión se acuerda con cada creadora (botón ⚙ Acuerdo). Esta es solo la propuesta que se carga al invitar a una nueva; después la ajustas con ella. No hay comisión por producto."
      aside={<LiveSaveState dirty={dirty} savedAt={savedAt} />}
    >
      <LiveAgreementEditor value={draft} onChange={setDraft} product={product} disabled={disabled || busy} />
      {disabled ? null : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!dirty || invalid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await updateLiveSuggestedAgreement(storeId, draftAgreement(draft));
                setSavedAt(new Date().toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" }));
                onSaved(saved.suggestedAgreement);
                toast.success("Comisión sugerida guardada");
              } catch (e) {
                toast.error(liveError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar comisión
          </Button>
          {dirty ? (
            <Button variant="outline" disabled={busy} onClick={() => setDraft(initial)}>
              Descartar
            </Button>
          ) : null}
        </div>
      )}
    </LivePanel>
  );
}

function AgreementDialog({
  storeId,
  seller,
  product,
  onClose,
  onSaved,
}: {
  storeId: string;
  seller: LiveSeller;
  product: SellerProductOption | null;
  onClose: () => void;
  onSaved: (seller: LiveSeller) => void;
}) {
  const [draft, setDraft] = useState(() => agreementDraft(seller.agreement));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const agreement = draftAgreement(draft);
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Acuerdo con {seller.name}</DialogTitle>
          <DialogDescription>
            Lo que acuerdes con ella aplica a todo lo que venda con su link. Se calcula con pagos validados y sin
            envío. Cambiarlo recalcula lo que todavía no se le pagó.
          </DialogDescription>
        </DialogHeader>
        <LiveAgreementEditor value={draft} onChange={setDraft} product={product} sellerName={seller.name} />
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !!agreementError(agreement)}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                onSaved(await updateLiveSellerAgreement(storeId, seller.id, agreement));
                toast.success(`Acuerdo con ${seller.name} guardado`);
              } catch (e) {
                setError(liveError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar acuerdo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductChecklist({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: SellerProductOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  if (!options.length)
    return <LiveEmpty>Primero agrega productos en Productos del live.</LiveEmpty>;
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange(options.map((o) => o.productId))}
        >
          Todos
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange([])}>
          Ninguno
        </Button>
      </div>
      <div className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border p-2">
        {options.map((option) => (
          <label
            key={option.productId}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60"
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              disabled={disabled}
              checked={selected.includes(option.productId)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, option.productId]
                    : selected.filter((id) => id !== option.productId),
                )
              }
            />
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{option.name}</b>
              <small className="text-muted-foreground">
                Tienda {liveMoney(option.regularPrice)} · live {liveMoney(option.livePrice)} · {option.stock} disp.
              </small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ProductsDialog({
  storeId,
  seller,
  options,
  onClose,
  onSaved,
}: {
  storeId: string;
  seller: LiveSeller;
  options: SellerProductOption[];
  onClose: () => void;
  onSaved: (seller: LiveSeller) => void;
}) {
  const [selected, setSelected] = useState(seller.productIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Productos de {seller.name}</DialogTitle>
          <DialogDescription>Solo estos salen en su link. Los cambios se ven al instante.</DialogDescription>
        </DialogHeader>
        <ProductChecklist options={options} selected={selected} onChange={setSelected} disabled={busy} />
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
        <DialogFooter className="items-center">
          <span className="mr-auto text-sm text-muted-foreground">
            {selected.length} producto{selected.length === 1 ? "" : "s"}
          </span>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                onSaved(await updateLiveSellerProducts(storeId, seller.id, selected));
                toast.success(`Productos de ${seller.name} guardados`);
              } catch (e) {
                setError(liveError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Etiqueta arriba, error debajo (fuera de la etiqueta, para que el nombre del campo no cambie). */
function TextField({
  id,
  label,
  value,
  error,
  className,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  className: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className={className}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      <LiveFieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function InviteDialog({
  storeId,
  advisor,
  suggested,
  options,
  links,
  onClose,
  onCreated,
}: {
  storeId: string;
  advisor?: { id: string; name: string; code: string };
  suggested: LiveSellersData["suggestedAgreement"];
  options: SellerProductOption[];
  links: LiveLinks;
  onClose: () => void;
  onCreated: (seller: LiveSeller) => void;
}) {
  const id = useId();
  const [name, setName] = useState(advisor?.name ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [social, setSocial] = useState("");
  const [draft, setDraft] = useState(() => agreementDraft(suggested));
  const [productIds, setProductIds] = useState(() => options.map((o) => o.productId));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const phoneDigits = phone.replace(/\D/g, "");
  const errors = {
    name: name.trim().length < 2 ? "Escribe su nombre y apellido." : "",
    email: email.trim() && !EMAIL.test(email.trim()) ? "Revisa el correo." : "",
    phone: phoneDigits && !/^9\d{8}$/.test(phoneDigits) ? "El WhatsApp tiene 9 dígitos y empieza con 9." : "",
    agreement: agreementError(draftAgreement(draft)),
    products: productIds.length ? "" : "Elige al menos un producto.",
  };
  const show = (key: keyof typeof errors) => (touched ? errors[key] : "");
  const field =
    "min-h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-teal-600 aria-[invalid=true]:border-red-500";
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{advisor ? `Pasar a comisión a ${advisor.name}` : "Invitar creadora o vendedor"}</DialogTitle>
          <DialogDescription>
            {advisor
              ? "Conserva su link: desde ahora lo que venda con él suma comisión."
              : "Se crea su link para vender con su nombre y su acuerdo de comisión."}
          </DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          className="grid gap-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setTouched(true);
            if (Object.values(errors).some(Boolean)) return;
            setBusy(true);
            setError("");
            try {
              onCreated(
                await createLiveSeller(storeId, {
                  name: name.trim(),
                  ...(email.trim() ? { email: email.trim() } : {}),
                  ...(phoneDigits ? { phone: phoneDigits } : {}),
                  ...(social.trim() ? { social: social.trim() } : {}),
                  agreement: draftAgreement(draft),
                  productIds,
                  ...(advisor ? { fromAdvisorId: advisor.id } : {}),
                }),
              );
            } catch (err) {
              setError(liveError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`${id}-name`}
              label="Nombre y apellido"
              value={name}
              error={show("name")}
              className={field}
              onChange={setName}
            />
            <TextField
              id={`${id}-email`}
              label="Correo (será su usuario)"
              type="email"
              placeholder="nombre@gmail.com"
              value={email}
              error={show("email")}
              className={field}
              onChange={setEmail}
            />
            <TextField
              id={`${id}-phone`}
              label="WhatsApp"
              inputMode="numeric"
              placeholder="9xx xxx xxx"
              value={phone}
              error={show("phone")}
              className={field}
              onChange={setPhone}
            />
            <TextField
              id={`${id}-social`}
              label="Red social (opcional)"
              placeholder="@usuario · TikTok"
              value={social}
              maxLength={120}
              className={field}
              onChange={setSocial}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Acuerdo de comisión</legend>
            <LiveAgreementEditor value={draft} onChange={setDraft} product={null} compact showError={touched} />
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Productos que puede vender</legend>
            <ProductChecklist options={options} selected={productIds} onChange={setProductIds} disabled={busy} />
            <LiveFieldError id={`${id}-products`} message={show("products")} />
          </fieldset>
          <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900">
            Se crea su link ({links.displayUrl ? `${links.displayUrl}?a=…` : "…/live?a=…"}). Con correo, también
            su acceso a {links.portalUrl.replace(/^https?:\/\//, "") || "su portal"}: te damos un enlace para
            mandárselo (vence en 7 días).
          </p>
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {advisor ? "Pasar a comisión" : "Crear su link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
