"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ExternalLink, ImagePlus, Link2, Package, Trash2, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useAlbum, useAlbumActions, useCatalogLink, useSheetCore } from "@/hooks/useCrmSalesTools";
import type { AlbumItem, AlbumKind, CatalogItem } from "@/types/crmSalesTools";
import { FichaCopyButton } from "./FichaView";
import { ContentError, ContentLoading } from "./ContentStatus";

const money = (n: number) => `S/ ${n.toFixed(2)}`;

function stockLabel(item: CatalogItem) {
  if (item.stockAvailable === null) return <span className="text-muted-foreground">Sin dato</span>;
  if (item.stockAvailable <= 0) return <Badge variant="destructive">Agotado</Badge>;
  return <span>{item.stockAvailable}</span>;
}

/** Precios y stock en vivo del producto vinculado en Powip Core (fila 49). */
export function FichaCoreStock({ sheetId, linked }: { sheetId: string; linked: boolean }) {
  const core = useSheetCore(linked ? sheetId : null);
  if (!linked) {
    return (
      <p className="text-xs text-muted-foreground">
        Esta ficha no está vinculada a un producto del Core. Un administrador puede vincularla en Guion → Fichas.
      </p>
    );
  }
  const d = core.data;
  return (
    <section aria-label="Precios y stock del Core" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Package className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Precios y stock (Powip Core)</h3>
        {d?.source === "mock" && <Badge variant="outline">Demostración</Badge>}
      </div>
      {core.isLoading && <ContentLoading />}
      {core.isError && <ContentError error={core.error} onRetry={() => core.refetch()} />}
      {d?.error && <p className="text-xs text-destructive">{d.error}</p>}
      {d && d.items.length === 0 && !d.error && (
        <p className="text-xs text-muted-foreground">El Core no devolvió variantes para este producto.</p>
      )}
      {d && d.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.items.map((it) => (
              <TableRow key={it.productVariantId} data-testid="core-variant">
                <TableCell className="font-medium">{it.variant || it.name}</TableCell>
                <TableCell className="text-muted-foreground">{it.sku ?? "—"}</TableCell>
                <TableCell className="text-right">{money(it.unitPrice)}</TableCell>
                <TableCell className="text-right">{stockLabel(it)}</TableCell>
                <TableCell>
                  <FichaCopyButton
                    text={`${it.name}${it.variant ? ` ${it.variant}` : ""}: ${money(it.unitPrice)}`}
                    label={`precio de ${it.variant || it.name}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<AlbumItem["status"], string> = {
  published: "Publicado",
  pending: "Por revisar",
  rejected: "Rechazado",
};

/** Kit / álbum de fotos y videos del producto (fila 48). */
export function FichaAlbum({ sheetId, sheetName }: { sheetId: string; sheetName: string }) {
  const { isAdmin } = useCrmMe();
  const album = useAlbum(sheetId);
  const actions = useAlbumActions(sheetId);
  const link = useCatalogLink();
  const [kind, setKind] = useState<AlbumKind>("photo");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const items = album.data ?? [];
  const validUrl = /^https?:\/\/\S+$/i.test(url.trim());

  const move = (index: number, delta: number) => {
    const ids = items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    actions.reorder.mutate(ids);
  };

  return (
    <section aria-label={`Álbum de ${sheetName}`} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ImagePlus className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Álbum del producto</h3>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={link.isPending}
          onClick={() => link.mutate({ sheetIds: [sheetId] })}
        >
          <Link2 /> Enlace para el cliente
        </Button>
      </div>
      {link.data && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs" data-testid="catalog-link">
          <a href={link.data.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all line-clamp-2 text-primary underline">
            {link.data.url}
          </a>
          <span className="text-muted-foreground">Vence {new Date(link.data.expiresAt).toLocaleDateString("es-PE")}</span>
          <FichaCopyButton text={link.data.url} label="enlace del catálogo" />
        </div>
      )}
      {album.isLoading && <ContentLoading />}
      {album.isError && <ContentError error={album.error} onRetry={() => album.refetch()} />}
      {album.data && items.length === 0 && (
        <p className="text-xs text-muted-foreground">Aún no hay fotos ni videos en el álbum.</p>
      )}
      {items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={it.id} className="space-y-1 rounded-md border p-2" data-testid="album-item">
              {it.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt={it.title} className="aspect-square w-full rounded object-cover" loading="lazy" />
              ) : (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex aspect-square w-full items-center justify-center rounded bg-muted text-primary"
                >
                  <Video className="h-8 w-8" aria-hidden />
                </a>
              )}
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{it.title}</span>
                {it.status !== "published" && (
                  <Badge variant={it.status === "rejected" ? "destructive" : "secondary"}>{STATUS_LABEL[it.status]}</Badge>
                )}
              </div>
              {it.proposedByName && it.status !== "published" && (
                <p className="truncate text-[11px] text-muted-foreground">Propuso: {it.proposedByName}</p>
              )}
              <div className="flex flex-wrap items-center gap-1">
                <a href={it.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${it.title}`} className="rounded p-1 hover:bg-accent">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <FichaCopyButton text={`${it.title}: ${it.url}`} label={`enlace de ${it.title}`} />
                {isAdmin && it.status === "pending" && (
                  <>
                    <Button size="sm" variant="ghost" aria-label={`Aprobar ${it.title}`} onClick={() => actions.review.mutate({ itemId: it.id, status: "published" })}>
                      <Check />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Rechazar ${it.title}`} onClick={() => actions.review.mutate({ itemId: it.id, status: "rejected" })}>
                      <X />
                    </Button>
                  </>
                )}
                {isAdmin && (
                  <>
                    <Button size="sm" variant="ghost" aria-label={`Subir ${it.title}`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Bajar ${it.title}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                  </>
                )}
                {(isAdmin || it.status !== "published") && (
                  <Button size="sm" variant="ghost" aria-label={`Quitar ${it.title}`} onClick={() => actions.remove.mutate(it.id)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-2 rounded-md border p-2 sm:grid-cols-[7rem_1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !validUrl) return;
          actions.add.mutate(
            { kind, title: title.trim(), url: url.trim() },
            { onSuccess: () => { setTitle(""); setUrl(""); } },
          );
        }}
      >
        <div className="space-y-1">
          <Label htmlFor={`album-kind-${sheetId}`}>Tipo</Label>
          <select
            id={`album-kind-${sheetId}`}
            value={kind}
            onChange={(e) => setKind(e.target.value as AlbumKind)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="photo">Foto</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`album-title-${sheetId}`}>Título</Label>
          <Input id={`album-title-${sheetId}`} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Vista frontal" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`album-url-${sheetId}`}>Enlace (https)</Label>
          <Input id={`album-url-${sheetId}`} maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <Button type="submit" size="sm" disabled={!title.trim() || !validUrl || actions.add.isPending}>
          {isAdmin ? "Agregar" : "Proponer"}
        </Button>
      </form>
      {!isAdmin && (
        <p className="text-[11px] text-muted-foreground">Tu propuesta queda pendiente hasta que un administrador la apruebe.</p>
      )}
    </section>
  );
}
