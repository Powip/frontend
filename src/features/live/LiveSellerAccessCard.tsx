"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useId, useState } from "react";
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
import LiveCopyButton from "./LiveCopyButton";
import { LiveFieldError, LivePanel } from "./LiveShared";
import type { LiveLinks } from "./liveLinks";
import { changeLiveSellerAccess, issueLiveSellerLink, liveError, updateLiveSeller } from "./liveService";
import type { LiveSeller, LiveSellerAccess } from "./types";

export interface IssuedLink {
  seller: LiveSeller;
  kind: "INVITE" | "RESET";
  url: string;
  expiresAt: string;
}

const STATUS: Record<string, { label: string; className: string }> = {
  NONE: { label: "Sin acceso", className: "bg-slate-100 text-slate-700" },
  INVITED: { label: "Invitada", className: "bg-sky-100 text-sky-800" },
  ACTIVE: { label: "Activa", className: "bg-emerald-100 text-emerald-800" },
  LOCKED: { label: "Bloqueada", className: "bg-red-100 text-red-800" },
  PAUSED: { label: "Pausada", className: "bg-amber-100 text-amber-800" },
};
export function accessState(access?: LiveSellerAccess | null) {
  if (!access) return "NONE";
  if (access.locked) return "LOCKED";
  return access.status;
}
const when = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * FEAT-33 L5b: «Accesos al portal de creadoras». El negocio crea cada acceso; hasta que haya proveedor de
 * correo, el enlace (invitación 7 días, restablecer 1 hora) se copia y se manda por WhatsApp.
 */
export default function LiveSellerAccessCard({
  storeId,
  sellers,
  links,
  onChanged,
  onIssued,
}: {
  storeId: string;
  sellers: LiveSeller[];
  links: LiveLinks;
  onChanged: (sellerId: string, patch: Partial<LiveSeller>) => void;
  onIssued: (link: IssuedLink) => void;
}) {
  const [busy, setBusy] = useState("");
  const [removing, setRemoving] = useState<LiveSeller | null>(null);
  const [emailFor, setEmailFor] = useState<LiveSeller | null>(null);
  const act = async (seller: LiveSeller, key: string, work: () => Promise<void>) => {
    setBusy(`${seller.id}:${key}`);
    try {
      await work();
    } catch (e) {
      toast.error(liveError(e));
    } finally {
      setBusy("");
    }
  };
  const issue = (seller: LiveSeller, kind: "invite" | "reset") =>
    act(seller, kind, async () => {
      const link = await issueLiveSellerLink(storeId, seller.id, kind);
      onChanged(seller.id, {
        access: {
          ...(seller.access ?? { status: "INVITED", hasPassword: false, lastLoginAt: null, locked: false, lockedUntil: null }),
          pendingLink: { kind: link.kind, expiresAt: link.expiresAt },
        },
      });
      onIssued({ seller, kind: link.kind, url: links.portalAccessUrl(link.token), expiresAt: link.expiresAt });
    });
  const change = (seller: LiveSeller, action: "pause" | "resume" | "unlock", message: string) =>
    act(seller, action, async () => {
      const { access } = await changeLiveSellerAccess(storeId, seller.id, action);
      onChanged(seller.id, { access });
      toast.success(message);
    });
  const spinner = (seller: LiveSeller, key: string) =>
    busy === `${seller.id}:${key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null;
  return (
    <LivePanel
      title="🔐 Accesos al portal de creadoras"
      description={`Tú creas cada acceso. La creadora entra en ${
        links.portalUrl.replace(/^https?:\/\//, "") || "su portal"
      } con su correo y su contraseña. Con 5 intentos fallidos se bloquea 15 minutos; puedes desbloquearla desde aquí.`}
    >
      {!links.portalUrl ? (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Primero ponle un nombre al catálogo en Configuración: el portal usa la misma dirección.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">Creadora / vendedor</th>
              <th className="py-2 pr-3 font-medium">Correo de acceso</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 pr-3 font-medium">Último ingreso</th>
              <th className="py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => {
              const state = accessState(seller.access);
              const status = STATUS[state];
              const disabled = !!busy || !links.portalUrl;
              return (
                <tr key={seller.id} className="border-b last:border-0" data-testid={`access-${seller.id}`}>
                  <td className="py-3 pr-3">
                    <b className="font-semibold">{seller.name}</b>
                    {seller.social || seller.phone ? (
                      <small className="block text-muted-foreground">
                        {[seller.social, seller.phone].filter(Boolean).join(" · ")}
                      </small>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">{seller.email || <small className="text-muted-foreground">—</small>}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    {state === "LOCKED" && seller.access?.lockedUntil ? (
                      <small className="block text-muted-foreground">hasta {when(seller.access.lockedUntil)}</small>
                    ) : null}
                    {seller.access?.pendingLink ? (
                      <small className="block text-muted-foreground">
                        Enlace vigente hasta {when(seller.access.pendingLink.expiresAt)}
                      </small>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    {seller.access?.lastLoginAt ? (
                      when(seller.access.lastLoginAt)
                    ) : (
                      <small className="text-muted-foreground">Nunca</small>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {state === "NONE" ? (
                        seller.email ? (
                          <Button size="sm" disabled={disabled} onClick={() => void issue(seller, "invite")}>
                            {spinner(seller, "invite")}Darle acceso
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setEmailFor(seller)}>
                            Agregar correo
                          </Button>
                        )
                      ) : null}
                      {state === "INVITED" ? (
                        <Button size="sm" variant="outline" disabled={disabled} onClick={() => void issue(seller, "invite")}>
                          {spinner(seller, "invite")}Reenviar invitación
                        </Button>
                      ) : null}
                      {state === "ACTIVE" ? (
                        <>
                          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void issue(seller, "reset")}>
                            {spinner(seller, "reset")}Restablecer contraseña
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!busy}
                            onClick={() => void change(seller, "pause", `Acceso de ${seller.name} pausado`)}
                          >
                            {spinner(seller, "pause")}Pausar acceso
                          </Button>
                        </>
                      ) : null}
                      {state === "LOCKED" ? (
                        <Button
                          size="sm"
                          disabled={!!busy}
                          onClick={() => void change(seller, "unlock", `${seller.name} ya puede volver a entrar`)}
                        >
                          {spinner(seller, "unlock")}Desbloquear
                        </Button>
                      ) : null}
                      {state === "PAUSED" ? (
                        <Button
                          size="sm"
                          disabled={!!busy}
                          onClick={() => void change(seller, "resume", `Acceso de ${seller.name} reactivado`)}
                        >
                          {spinner(seller, "resume")}Reactivar
                        </Button>
                      ) : null}
                      {state !== "NONE" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          disabled={!!busy}
                          onClick={() => setRemoving(seller)}
                        >
                          Quitar acceso
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        En su portal la creadora solo ve sus productos habilitados, sus ventas (sin teléfono, dirección ni DNI del
        cliente) y sus ganancias. No puede ver ni cambiar nada más del negocio.
      </p>
      {removing ? (
        <Dialog open onOpenChange={(open) => (!open && !busy ? setRemoving(null) : undefined)}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>¿Quitar el acceso de {removing.name}?</DialogTitle>
              <DialogDescription>
                Se cierra su sesión y ya no puede entrar a su portal. Su link de venta y sus comisiones siguen
                igual. Para que vuelva a entrar, tendrás que darle acceso de nuevo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" disabled={!!busy} onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={!!busy}
                onClick={() =>
                  void act(removing, "remove", async () => {
                    await changeLiveSellerAccess(storeId, removing.id, "remove");
                    onChanged(removing.id, { access: null });
                    toast.success(`Se quitó el acceso de ${removing.name}`);
                    setRemoving(null);
                  })
                }
              >
                {spinner(removing, "remove")}Quitar acceso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {emailFor ? (
        <EmailDialog
          storeId={storeId}
          seller={emailFor}
          onClose={() => setEmailFor(null)}
          onSaved={(seller) => {
            onChanged(seller.id, { email: seller.email });
            setEmailFor(null);
          }}
        />
      ) : null}
    </LivePanel>
  );
}

function EmailDialog({
  storeId,
  seller,
  onClose,
  onSaved,
}: {
  storeId: string;
  seller: LiveSeller;
  onClose: () => void;
  onSaved: (seller: LiveSeller) => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Correo de {seller.name}</DialogTitle>
          <DialogDescription>Será su usuario para entrar a su portal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1">
          <label htmlFor={`${id}-email`} className="text-sm font-semibold">
            Correo
          </label>
          <input
            id={`${id}-email`}
            type="email"
            className="min-h-11 rounded-xl border bg-background px-3 text-sm"
            value={email}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          <LiveFieldError id={`${id}-error`} message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Revisa el correo.");
              setBusy(true);
              try {
                onSaved(await updateLiveSeller(storeId, seller.id, { email: email.trim() }));
              } catch (e) {
                setError(liveError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** El enlace se muestra una sola vez: se copia o se manda por WhatsApp. */
export function IssuedLinkDialog({
  link,
  storeName,
  onClose,
}: {
  link: IssuedLink;
  storeName: string;
  onClose: () => void;
}) {
  const first = link.seller.name.split(" ")[0];
  const text =
    link.kind === "INVITE"
      ? `Hola ${first}, ${storeName} te invitó a su portal de creadoras. Crea tu contraseña aquí (vence en 7 días): ${link.url}`
      : `Hola ${first}, crea una nueva contraseña para tu portal aquí (vence en 1 hora): ${link.url}`;
  const phone = link.seller.phone && /^9\d{8}$/.test(link.seller.phone) ? link.seller.phone : null;
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {link.kind === "INVITE" ? `Invitación para ${link.seller.name}` : `Nueva contraseña para ${link.seller.name}`}
          </DialogTitle>
          <DialogDescription>
            Mándale este enlace. Es de un solo uso y vence {link.kind === "INVITE" ? "en 7 días" : "en 1 hora"}. Por
            seguridad no se vuelve a mostrar: si se pierde, genera otro.
          </DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-xl bg-muted/60 px-3 py-2 text-sm" data-testid="issued-link">
          {link.url}
        </p>
        <p className="text-xs text-muted-foreground">Su usuario es su correo: {link.seller.email}</p>
        <DialogFooter className="gap-2 sm:justify-between">
          <LiveCopyButton text={text} label="Copiar mensaje" size="default" />
          {phone ? (
            <Button asChild variant="outline">
              <a href={`https://wa.me/51${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
              </a>
            </Button>
          ) : null}
          <Button onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
