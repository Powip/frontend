"use client";

import { Check, Edit2, Loader2, Palette, Plus, RefreshCw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CreateStoreSalesChannel,
  StoreChannelType,
  StoreSalesChannel,
} from "@/services/storeChannelsService";
import {
  createStoreSalesChannel,
  deactivateStoreSalesChannel,
  fetchStoreSalesChannels,
  storeChannelError,
  updateStorePresentation,
  updateStoreSalesChannel,
} from "@/services/storeChannelsService";

export interface ChannelCommercialStore {
  id: string;
  name: string;
  color?: string | null;
  is_legacy?: boolean;
  is_active?: boolean;
}
interface Props {
  stores: ChannelCommercialStore[];
  initialStoreId?: string;
  canManage: boolean;
  onColorChange: (storeId: string, color: string | null) => void;
}
const CHANNEL_LABELS: Record<StoreChannelType, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WEB: "Web",
  SHOPIFY: "Shopify",
  TIKTOK: "TikTok",
  MARKETPLACE: "Marketplace",
  PHYSICAL: "Tienda física",
  OTHER: "Otro",
};
const CHANNEL_OPTIONS = Object.entries(CHANNEL_LABELS) as Array<[StoreChannelType, string]>;
const DEFAULT_COLOR = "#7C3AED";
const emptyChannel = (): CreateStoreSalesChannel => ({
  type: "WHATSAPP",
  label: "",
  identifier: "",
  externalId: "",
});
const colorValue = (value?: string | null) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_COLOR;

export function validateChannelInput(input: CreateStoreSalesChannel): string | null {
  if (!input.label.trim() || input.label.trim().length > 100)
    return "Escribe un nombre para el canal.";
  const identifier = input.identifier?.trim() || "";
  if (
    ["WHATSAPP", "WEB", "SHOPIFY", "INSTAGRAM", "FACEBOOK", "TIKTOK"].includes(input.type) &&
    !identifier &&
    !input.externalId?.trim()
  )
    return "Completa el teléfono, perfil o dominio del canal.";
  if (
    input.type === "WHATSAPP" &&
    !/^\+[1-9][0-9]{6,14}$/.test(identifier.replace(/[\s().-]/g, ""))
  )
    return "Escribe el número con + y código de país.";
  if (input.externalId?.trim() && !/^[1-9][0-9]{0,39}$/.test(input.externalId.trim()))
    return "El ID del perfil debe ser numérico.";
  return null;
}

export default function StoreSalesChannels({
  stores,
  initialStoreId = "",
  canManage,
  onColorChange,
}: Props) {
  const formId = useId();
  const commercial = stores.filter((store) => !store.is_legacy && store.is_active !== false);
  const [selected, setSelected] = useState(initialStoreId);
  const selectedId = commercial.some((store) => store.id === selected)
    ? selected
    : commercial.length === 1
      ? commercial[0].id
      : "";
  const store = commercial.find((row) => row.id === selectedId);
  const [channels, setChannels] = useState<StoreSalesChannel[]>([]);
  const visibleChannels = channels.filter((row) => row.storeId === selectedId);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreSalesChannel | null>(null);
  const [draft, setDraft] = useState<CreateStoreSalesChannel>(emptyChannel);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<StoreSalesChannel | null>(null);
  const [draftColor, setDraftColor] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh vuelve a consultar los canales tras guardar o reintentar.
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setChannels([]);
    setLoadError(false);
    if (!selectedId) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    fetchStoreSalesChannels(selectedId, controller.signal)
      .then((rows) => {
        if (current) setChannels(rows);
      })
      .catch(() => {
        if (current && !controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [selectedId, refresh]);

  const chooseStore = (id: string) => {
    setSelected(id);
    setDraftColor(null);
    setFormOpen(false);
    setDeactivating(null);
  };
  const openForm = (channel?: StoreSalesChannel) => {
    setEditing(channel ?? null);
    setDraft(
      channel
        ? {
            type: channel.type,
            label: channel.label,
            identifier: channel.identifier,
            externalId: channel.externalId,
          }
        : emptyChannel(),
    );
    setFormError(null);
    setFormOpen(true);
  };
  const saveChannel = async () => {
    if (!store || !canManage || busy) return;
    const error = editing
      ? !draft.label.trim()
        ? "Escribe un nombre para el canal."
        : null
      : validateChannelInput(draft);
    if (error) {
      setFormError(error);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing)
        await updateStoreSalesChannel(store.id, editing.id, {
          label: draft.label,
        });
      else await createStoreSalesChannel(store.id, draft);
      setFormOpen(false);
      setRefresh((value) => value + 1);
      toast.success(editing ? "Nombre actualizado" : "Canal agregado");
    } catch (error) {
      setFormError(storeChannelError(error));
    } finally {
      setBusy(false);
    }
  };
  const changeActive = async (channel: StoreSalesChannel, active: boolean) => {
    if (!store || !canManage || busy) return;
    setBusy(true);
    try {
      const result = active
        ? await updateStoreSalesChannel(store.id, channel.id, {
            isActive: true,
          })
        : await deactivateStoreSalesChannel(store.id, channel.id);
      setChannels((rows) => rows.map((row) => (row.id === result.id ? result : row)));
      setDeactivating(null);
      toast.success(active ? "Canal reactivado" : "Canal desactivado");
    } catch (error) {
      toast.error(storeChannelError(error));
    } finally {
      setBusy(false);
    }
  };
  const saveColor = async (color: string | null) => {
    if (!store || !canManage || busy) return;
    setBusy(true);
    try {
      const result = await updateStorePresentation(store.id, color);
      onColorChange(store.id, result.color);
      setDraftColor(null);
      toast.success("Color actualizado");
    } catch (error) {
      toast.error(storeChannelError(error));
    } finally {
      setBusy(false);
    }
  };
  const isWeb = draft.type === "WEB" || draft.type === "SHOPIFY";
  const identifierLabel =
    draft.type === "WHATSAPP"
      ? "Número de WhatsApp"
      : isWeb
        ? "Dominio web"
        : ["INSTAGRAM", "FACEBOOK", "TIKTOK"].includes(draft.type)
          ? "Usuario o perfil"
          : "Identificador (opcional)";

  return (
    <Card>
      <CardHeader className="gap-3">
        <div>
          <CardTitle>Canales de cada tienda</CardTitle>
          <CardDescription className="mt-2">
            Registra su WhatsApp, perfil o web para identificar las ventas y el gasto.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-sm space-y-1.5">
            <Label htmlFor={`${formId}-store`}>Tienda</Label>
            <Select
              value={selectedId}
              onValueChange={chooseStore}
              disabled={busy || !commercial.length}
            >
              <SelectTrigger id={`${formId}-store`} className="w-full">
                <SelectValue placeholder="Selecciona una tienda" />
              </SelectTrigger>
              <SelectContent>
                {commercial.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canManage ? (
            <Button
              onClick={() => openForm()}
              disabled={!store || busy || loading || loadError}
              className="self-start sm:self-end"
            >
              <Plus aria-hidden="true" />
              Agregar canal
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!commercial.length ? (
          <p className="text-sm text-muted-foreground">
            Crea una tienda comercial para registrar sus canales.
          </p>
        ) : !store ? (
          <p className="text-sm text-muted-foreground">Elige la tienda que quieres configurar.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Palette className="size-4 text-muted-foreground" aria-hidden="true" />
              <Label htmlFor={`${formId}-color`}>Color en Publicidad</Label>
              <Input
                id={`${formId}-color`}
                type="color"
                value={draftColor ?? colorValue(store.color)}
                onChange={(event) => setDraftColor(event.target.value)}
                disabled={!canManage || busy}
                className="h-9 w-12 cursor-pointer p-1"
              />
              {canManage &&
              draftColor &&
              draftColor.toUpperCase() !== store.color?.toUpperCase() ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveColor(draftColor)}
                  disabled={busy}
                >
                  Guardar color
                </Button>
              ) : null}
              {canManage && store.color ? (
                <Button variant="ghost" size="sm" onClick={() => saveColor(null)} disabled={busy}>
                  Usar color automático
                </Button>
              ) : null}
            </div>
            {loading ? (
              <div role="status" aria-label="Cargando canales" className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : loadError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  No se pudieron cargar los canales de esta tienda.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : visibleChannels.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Aún no hay canales en esta tienda.
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {visibleChannels.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{row.label}</p>
                        <Badge variant="secondary">{CHANNEL_LABELS[row.type]}</Badge>
                        {!row.isActive ? <Badge variant="outline">Inactivo</Badge> : null}
                      </div>
                      <p className="break-all text-sm text-muted-foreground">
                        {row.identifier ||
                          (row.externalId ? `ID ${row.externalId}` : "Sin identificador")}
                      </p>
                      {row.identifier && row.externalId ? (
                        <p className="text-xs text-muted-foreground">ID {row.externalId}</p>
                      ) : null}
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openForm(row)}
                          disabled={busy}
                          aria-label={`Editar nombre de ${row.label}`}
                        >
                          <Edit2 aria-hidden="true" />
                          Editar nombre
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            row.isActive ? setDeactivating(row) : changeActive(row, true)
                          }
                        >
                          {row.isActive ? (
                            "Desactivar"
                          ) : (
                            <>
                              <RefreshCw aria-hidden="true" />
                              Reactivar
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!busy) setFormOpen(open);
        }}
      >
        <DialogContent showCloseButton={!busy} className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar nombre del canal" : "Agregar canal"}</DialogTitle>
            <DialogDescription>
              {editing ? "Para cambiar el teléfono, perfil o web, agrega otro canal." : store?.name}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveChannel();
            }}
            className="space-y-4"
          >
            {!editing ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-type`}>Tipo de canal</Label>
                <Select
                  value={draft.type}
                  onValueChange={(type) => {
                    if (Object.hasOwn(CHANNEL_LABELS, type))
                      setDraft({
                        ...draft,
                        type: type as StoreChannelType,
                        identifier: "",
                        externalId: "",
                      });
                  }}
                  disabled={busy}
                >
                  <SelectTrigger id={`${formId}-type`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(([type, label]) => (
                      <SelectItem value={type} key={type}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-name`}>Nombre del canal</Label>
              <Input
                id={`${formId}-name`}
                autoFocus
                required
                maxLength={100}
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                disabled={busy}
                placeholder="Ej.: WhatsApp ventas"
              />
            </div>
            {!editing ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${formId}-identifier`}>{identifierLabel}</Label>
                  <Input
                    id={`${formId}-identifier`}
                    maxLength={512}
                    value={draft.identifier ?? ""}
                    onChange={(event) => setDraft({ ...draft, identifier: event.target.value })}
                    disabled={busy}
                    placeholder={
                      draft.type === "WHATSAPP"
                        ? "+51 987 111 222"
                        : isWeb
                          ? "mitienda.pe"
                          : "@nombre_de_tienda"
                    }
                    aria-describedby={
                      draft.type === "WHATSAPP" || isWeb ? `${formId}-help` : undefined
                    }
                  />
                  {draft.type === "WHATSAPP" || isWeb ? (
                    <p id={`${formId}-help`} className="text-xs text-muted-foreground">
                      {isWeb
                        ? "Solo el dominio, sin rutas ni parámetros."
                        : "Con + y código de país."}
                    </p>
                  ) : null}
                </div>
                {draft.type === "FACEBOOK" || draft.type === "INSTAGRAM" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`${formId}-external`}>ID del perfil (opcional)</Label>
                    <Input
                      id={`${formId}-external`}
                      maxLength={40}
                      inputMode="numeric"
                      value={draft.externalId ?? ""}
                      onChange={(event) => setDraft({ ...draft, externalId: event.target.value })}
                      disabled={busy}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                {editing ? "Guardar nombre" : "Agregar canal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deactivating}
        onOpenChange={(open) => {
          if (!busy && !open) setDeactivating(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar {deactivating?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se conserva el historial. El canal dejará de estar disponible para nuevas ventas y
              asignaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (deactivating) void changeActive(deactivating, false);
              }}
            >
              {busy ? "Desactivando…" : "Desactivar canal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
