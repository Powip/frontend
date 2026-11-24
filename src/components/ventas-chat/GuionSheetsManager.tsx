"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import CoreProductPicker from "./CoreProductPicker";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSheetActions, useSheets } from "@/hooks/useCrmContent";
import type { Sheet, SheetInput } from "@/types/crmContent";
import ConfirmDialog from "./ConfirmDialog";
import { SHEET_NAME_MAX, SHEET_TEXT_MAX } from "./ContentLib";
import { ContentError, ContentLoading } from "./ContentStatus";
import GuionMaterialList from "./GuionMaterialList";

const TEXT_FIELDS: Array<{ key: "forWhom" | "highlights" | "alternatives" | "complements"; label: string }> = [
  { key: "forWhom", label: "Para quién es" },
  { key: "highlights", label: "Qué destacar" },
  { key: "alternatives", label: "Alternativas" },
  { key: "complements", label: "Complementos" },
];

interface DialogProps {
  open: boolean;
  sheet: Sheet | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: SheetInput & { active?: boolean }) => void;
}

function SheetDialog({ open, sheet, busy, onClose, onSave }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open && <SheetForm key={sheet?.id ?? "new"} sheet={sheet} busy={busy} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function SheetForm({ sheet, busy, onClose, onSave }: Omit<DialogProps, "open">) {
  const [name, setName] = useState(sheet?.name ?? "");
  const [price, setPrice] = useState(sheet?.price ?? "");
  const [coreProductId, setCoreProductId] = useState(sheet?.coreProductId ?? "");
  const [texts, setTexts] = useState({
    forWhom: sheet?.forWhom ?? "",
    highlights: sheet?.highlights ?? "",
    alternatives: sheet?.alternatives ?? "",
    complements: sheet?.complements ?? "",
  });
  const [active, setActive] = useState(sheet?.active ?? true);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        onSave({
          name: name.trim(),
          price: price.trim(),
          // Solo viaja si hay vínculo o si se quita uno que ya existía.
          ...(coreProductId || sheet?.coreProductId ? { coreProductId } : {}),
          ...texts,
          ...(sheet ? { active } : {}),
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{sheet ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        <DialogDescription>
          Describe el producto como lo cuentas en el chat. Vincúlalo al Core para mostrar precios y stock reales.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Label htmlFor="sh-name">Nombre</Label>
        <Input id="sh-name" maxLength={SHEET_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sh-price">Precio</Label>
        <Input id="sh-price" maxLength={SHEET_TEXT_MAX} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej.: S/ 89" />
      </div>
      <CoreProductPicker value={coreProductId} onChange={setCoreProductId} />
      {TEXT_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label htmlFor={`sh-${f.key}`}>{f.label}</Label>
          <Textarea
            id={`sh-${f.key}`}
            rows={2}
            maxLength={SHEET_TEXT_MAX}
            value={texts[f.key]}
            onChange={(e) => setTexts((t) => ({ ...t, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      {sheet && (
        <div className="flex items-center gap-2">
          <Switch id="sh-active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="sh-active">Activo (Pau y el chat lo usan)</Label>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim() || busy}>
          Guardar producto
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Gestor de productos (fichas de venta) con su material. */
export default function GuionSheetsManager() {
  const [search, setSearch] = useState("");
  const sheets = useSheets(search);
  const actions = useSheetActions();
  const [editing, setEditing] = useState<Sheet | "new" | null>(null);
  const [deleting, setDeleting] = useState<Sheet | null>(null);
  const [openMaterial, setOpenMaterial] = useState<string | null>(null);
  const busy = actions.create.isPending || actions.update.isPending;

  return (
    <section aria-labelledby="guion-productos" className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="guion-productos" className="text-base font-semibold">
            Productos (fichas)
          </h2>
          <p className="text-sm text-muted-foreground">
            Lo que el equipo ve en la pestaña Ficha y en el chat. Pau también lee las fichas activas.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> Nuevo producto
        </Button>
      </div>
      <Input
        icon={Search}
        aria-label="Buscar producto"
        placeholder="Buscar producto…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {sheets.isLoading && <ContentLoading />}
      {sheets.isError && <ContentError error={sheets.error} onRetry={() => sheets.refetch()} />}
      {sheets.data && sheets.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search.trim() ? "Ningún producto coincide." : "Aún no hay productos."}
        </p>
      )}
      <ul className="space-y-2">
        {sheets.data?.map((s) => (
          <li key={s.id} className="space-y-2 rounded-md border p-3" data-testid="sheet-row">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 break-words sm:truncate text-sm font-semibold">{s.name}</span>
              {s.price && <span className="text-sm text-muted-foreground">{s.price}</span>}
              {s.coreProductId && <Badge variant="secondary">Core</Badge>}
              {!s.active && <Badge variant="outline">Inactivo</Badge>}
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={openMaterial === s.id}
                onClick={() => setOpenMaterial(openMaterial === s.id ? null : s.id)}
              >
                Material ({s.materials.length}) {openMaterial === s.id ? <ChevronUp /> : <ChevronDown />}
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Editar ${s.name}`} onClick={() => setEditing(s)}>
                <Pencil />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${s.name}`} onClick={() => setDeleting(s)}>
                <Trash2 />
              </Button>
            </div>
            {openMaterial === s.id && (
              <GuionMaterialList sheetId={s.id} items={s.materials} label={`Material de ${s.name}`} />
            )}
          </li>
        ))}
      </ul>

      <SheetDialog
        open={!!editing}
        sheet={editing && editing !== "new" ? editing : null}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          const target = editing;
          if (target === "new") actions.create.mutate(input, { onSuccess: () => setEditing(null) });
          else if (target) actions.update.mutate({ id: target.id, input }, { onSuccess: () => setEditing(null) });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="¿Eliminar este producto?"
        description={`Se eliminará «${deleting?.name ?? ""}» con su material. Pau y las vendedoras dejarán de verlo.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const s = deleting;
          setDeleting(null);
          if (s) actions.remove.mutate(s.id);
        }}
      />
    </section>
  );
}
