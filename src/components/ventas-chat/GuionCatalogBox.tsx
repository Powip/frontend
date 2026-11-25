"use client";
import { useEffect, useState } from "react";
import { FileText, RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCatalogAttribution, useCatalogSettings, useCatalogSettingsActions, blockDKKeys } from "@/hooks/useCrmBlockDK";
import { generateCatalogPdf } from "@/services/crmBlockDKService";
import { crmError } from "@/services/crmService";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "./format";

const MIN_DAYS = 1;
const MAX_DAYS = 30;

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Botón «Catálogo PDF» con modal: lo genera de los productos con precios y stock de hoy. */
function CatalogPdfButton() {
  const qc = useQueryClient();
  const settings = useCatalogSettings();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generatedAt = settings.data?.pdfGeneratedAt ?? null;

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const regenerate = async () => {
    setBusy(true);
    try {
      const blob = await generateCatalogPdf();
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      toast.success("Catálogo PDF regenerado con precios y stock de hoy");
      qc.invalidateQueries({ queryKey: blockDKKeys.catalogSettings });
    } catch (err) {
      toast.error(crmError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md border bg-background p-3 text-left hover:bg-muted/50"
      >
        <span className="flex size-9 flex-none items-center justify-center rounded-md bg-sky-100 text-sky-700">
          <FileText className="size-4" />
        </span>
        <span className="min-w-0">
          <b className="block text-sm">Catálogo PDF</b>
          <small className="block text-xs text-muted-foreground">
            Generado de tus productos · {isToday(generatedAt) ? "hoy" : generatedAt ? new Date(generatedAt).toLocaleDateString("es-PE") : "aún no"} · Regenerar
          </small>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catálogo PDF</DialogTitle>
            <DialogDescription>
              {generatedAt
                ? `Generado ${isToday(generatedAt) ? "hoy" : new Date(generatedAt).toLocaleDateString("es-PE")} · con precios y stock de ese momento`
                : "Aún no se ha generado. Se arma con tus productos, precios y stock de hoy."}
            </DialogDescription>
          </DialogHeader>
          {url ? (
            <iframe title="Vista previa del catálogo PDF" src={url} className="h-80 w-full rounded-md border" />
          ) : (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Regenera para ver la vista previa y descargarlo.
            </p>
          )}
          <DialogFooter className="gap-2">
            {url && (
              <Button asChild variant="outline">
                <a href={url} download="catalogo.pdf">
                  Descargar
                </a>
              </Button>
            )}
            <Button onClick={regenerate} disabled={busy}>
              <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
              Regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Catálogo POWIP Link (mockup 152, K5): ventas atribuidas, días de atribución
 * (ajustes del CRM), mostrar agotados y Catálogo PDF.
 */
export default function GuionCatalogBox() {
  const { stores } = useCrmMe();
  const settings = useCatalogSettings();
  const attribution = useCatalogAttribution();
  const { soldOut, days } = useCatalogSettingsActions();
  const savedDays = settings.data?.attributionDays ?? 7;
  const [draftDays, setDraftDays] = useState(String(savedDays));

  useEffect(() => setDraftDays(String(savedDays)), [savedDays]);

  const commitDays = () => {
    const n = Number(draftDays);
    if (!Number.isInteger(n) || n < MIN_DAYS || n > MAX_DAYS) {
      toast.error(`Los días van de ${MIN_DAYS} a ${MAX_DAYS}`);
      setDraftDays(String(savedDays));
      return;
    }
    if (n !== savedDays) days.mutate(n);
  };

  const a = attribution.data;
  const storeNames = stores.map((s) => s.name);

  return (
    <div className="space-y-3">
      <section aria-label="Catálogo POWIP Link" className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <span className="flex size-9 flex-none items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Store className="size-4" />
          </span>
          <span className="min-w-0 grow">
            <b className="block text-sm">Catálogo POWIP Link · gratis</b>
            <small className="block truncate text-xs text-muted-foreground">
              {storeNames.length ? storeNames.join(" · ") : "Tus tiendas"} · stock y precios en vivo
            </small>
          </span>
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
            Activo
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Ventas de catálogo este mes">
          <span>
            <b className="text-foreground">{a?.orders ?? "—"}</b> ventas de catálogo este mes
          </span>
          <span>
            <b className="text-foreground">{a ? formatMoney(a.billed) : "—"}</b> facturado
          </span>
          <span>
            <b className="text-foreground">{a?.bySeller ?? "—"}</b> de vendedoras (≤ {a?.days ?? savedDays} días)
          </span>
          <span>
            <b className="text-foreground">{a?.withoutSeller ?? "—"}</b> sin vendedora
          </span>
        </div>
        <div className="flex items-center gap-3 border-t pt-2">
          <div className="grow text-sm">
            Atribuir a la vendedora que lo envió
            <small className="block text-xs text-muted-foreground">
              Si el cliente compra dentro de {savedDays} {savedDays === 1 ? "día" : "días"} es su venta; después es venta de catálogo
            </small>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Input
              type="number"
              min={MIN_DAYS}
              max={MAX_DAYS}
              aria-label="Días de atribución"
              className="h-8 w-16"
              value={draftDays}
              disabled={settings.isLoading || days.isPending}
              onChange={(e) => setDraftDays(e.target.value)}
              onBlur={commitDays}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            días
          </div>
        </div>
        <div className="flex items-center gap-3 border-t pt-2">
          <div className="grow text-sm">
            Mostrar productos agotados
            <small className="block text-xs text-muted-foreground">Si está apagado, el catálogo oculta variantes sin stock</small>
          </div>
          <Switch
            aria-label="Mostrar agotados"
            checked={settings.data?.showSoldOut ?? false}
            disabled={settings.isLoading || soldOut.isPending}
            onCheckedChange={(v) => soldOut.mutate(v)}
          />
        </div>
      </section>
      <CatalogPdfButton />
    </div>
  );
}
