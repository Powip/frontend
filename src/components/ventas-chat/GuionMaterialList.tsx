"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMaterialActions } from "@/hooks/useCrmContent";
import type { Material, MaterialKind } from "@/types/crmContent";
import ConfirmDialog from "./ConfirmDialog";
import {
  MATERIAL_KIND_LABEL,
  MATERIAL_KIND_OPTIONS,
  MATERIAL_TITLE_MAX,
  MATERIAL_URL_MAX,
  isHttpUrl,
} from "./ContentLib";
import { NATIVE_SELECT_CLASS } from "./format";

const SELECT = cn(NATIVE_SELECT_CLASS, "h-9 text-sm");

interface FormProps {
  initial?: Material;
  busy: boolean;
  onSave: (v: { kind: MaterialKind; title: string; url: string }) => void;
  onCancel?: () => void;
}

function MaterialForm({ initial, busy, onSave, onCancel }: FormProps) {
  const [kind, setKind] = useState<MaterialKind>(initial?.kind ?? "link");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const valid = title.trim().length > 0 && isHttpUrl(url.trim());
  const idKey = `mk-${initial?.id ?? "new"}`;
  return (
    <form
      className="grid gap-2 rounded-md border bg-muted/30 p-2 md:grid-cols-[8rem_1fr_2fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || busy) return;
        onSave({ kind, title: title.trim(), url: url.trim() });
        if (!initial) {
          setTitle("");
          setUrl("");
        }
      }}
    >
      <div>
        <Label className="sr-only" htmlFor={idKey}>
          Tipo de material
        </Label>
        <select id={idKey} className={SELECT} value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
          {MATERIAL_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Input
        aria-label="Título del material"
        placeholder="Título"
        maxLength={MATERIAL_TITLE_MAX}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        aria-label="Enlace del material"
        placeholder="https://…"
        maxLength={MATERIAL_URL_MAX}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={!valid || busy}>
          {initial ? (
            "Guardar"
          ) : (
            <>
              <Plus /> Añadir
            </>
          )}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

interface Props {
  /** Sin `sheetId` = material general del negocio. */
  sheetId?: string;
  items: Material[];
  /** Nombre accesible de la lista. */
  label: string;
}

/** Lista editable (administrador) de materiales: añadir, editar, reordenar y eliminar. */
export default function GuionMaterialList({ sheetId, items, label }: Props) {
  const actions = useMaterialActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const busy = actions.create.isPending || actions.update.isPending || actions.remove.isPending;

  // Cada elemento toma como posición su índice: se actualizan solo los dos que cambian.
  const move = (index: number, to: number) => {
    const a = items[index];
    const b = items[to];
    if (!a || !b) return;
    actions.update.mutate({ id: a.id, input: { position: to } });
    actions.update.mutate({ id: b.id, input: { position: index } });
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay material.</p>}
      <ul aria-label={label} className="space-y-2">
        {items.map((m, i) => (
          <li key={m.id} data-testid="material-row">
            {editing === m.id ? (
              <MaterialForm
                initial={m}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(v) => actions.update.mutate({ id: m.id, input: v }, { onSuccess: () => setEditing(null) })}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                <Badge variant="secondary">{MATERIAL_KIND_LABEL[m.kind]}</Badge>
                <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary underline"
                  aria-label={`Abrir ${m.title}`}
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
                <Button size="icon-sm" variant="ghost" aria-label={`Subir ${m.title}`} disabled={busy || i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Bajar ${m.title}`} disabled={busy || i === items.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${m.title}`} onClick={() => setEditing(m.id)}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${m.title}`} onClick={() => setDeleting(m)}>
                  <Trash2 />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <MaterialForm busy={busy} onSave={(v) => actions.create.mutate({ ...v, ...(sheetId ? { sheetId } : {}) })} />
      <ConfirmDialog
        open={!!deleting}
        title="¿Eliminar este material?"
        description={`Se quitará «${deleting?.title ?? ""}». Las vendedoras ya no lo verán en el chat.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const m = deleting;
          setDeleting(null);
          if (m) actions.remove.mutate(m.id);
        }}
      />
    </div>
  );
}
