"use client";
import { useRef, useState, type ReactNode } from "react";
import { CheckCircle2, FileText, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCrmMe } from "@/hooks/useCrmMe";
import {
  useApprovePauLearning,
  useDiscardPauLearning,
  usePauLearning,
  useRemovePauDocument,
  useUploadPauDocument,
} from "@/hooks/useCrmPauLearning";
import {
  PAU_DOC_ACCEPT,
  PAU_DOC_MAX_BYTES,
  type PauDocStatus,
  type PauPendingItem,
} from "@/services/crmPauLearningService";

const DOC_STATUS: Record<PauDocStatus, { label: string; variant: "success" | "warning" | "error" | "info" }> = {
  processing: { label: "Procesando", variant: "warning" },
  proposed: { label: "Por revisar", variant: "info" },
  learned: { label: "Aprendido", variant: "success" },
  failed: { label: "No se pudo leer", variant: "error" },
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "");

function Card({ title, subtitle, action, children, id }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** «Respuesta oficial»: editar la propuesta o escribir la que falta, y aprobar. */
function AnswerDialog({ item, onClose }: { item: PauPendingItem | null; onClose: () => void }) {
  const approve = useApprovePauLearning();
  const [text, setText] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  if (item && forId !== item.id) {
    setForId(item.id);
    setText(item.answer ?? "");
  }
  const save = () => {
    if (!item || !text.trim()) return;
    approve.mutate({ source: item.source, id: item.id, answer: text.trim() }, { onSuccess: onClose });
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Respuesta oficial</DialogTitle>
          <DialogDescription>«{item?.question}»</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="pau-official-answer">Lo que Pau responderá</Label>
          <Textarea
            id="pau-official-answer"
            rows={5}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe la respuesta tal como quieres que la diga Pau."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!text.trim() || approve.isPending}>
            {approve.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
            Guardar y aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** «Subir documento»: Pau lo lee y propone respuestas para aprobar. */
function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { stores } = useCrmMe();
  const upload = useUploadPauDocument();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setFile(null);
    setName("");
    setStoreId("");
    setError(null);
    onClose();
  };
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > PAU_DOC_MAX_BYTES) {
      setError("El archivo pesa más de 10 MB.");
      return;
    }
    setError(null);
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ""));
  };
  const send = () => {
    if (!file) return;
    upload.mutate({ file, name, storeId: storeId || undefined }, { onSuccess: close });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
          <DialogDescription>Pau lo lee y te propone respuestas para aprobar.</DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
        >
          <Upload className="h-5 w-5" aria-hidden />
          <b className="text-foreground">{file ? file.name : "Elegir PDF, Word o Excel"}</b>
          <span className="text-xs">Políticas, tablas de medidas, preguntas frecuentes · hasta 10 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          accept={PAU_DOC_ACCEPT}
          className="hidden"
          aria-label="Archivo del documento"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="pau-doc-name">Nombre</Label>
            <Input id="pau-doc-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Política de cambios" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pau-doc-store">Tienda</Label>
            <select
              id="pau-doc-store"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={!file || upload.isPending}>
            {upload.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
            Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pestaña Pau → Aprende (mockup 152): nada llega a los clientes sin aprobación. */
export function PauAprende() {
  const { stores } = useCrmMe();
  const data = usePauLearning();
  const approve = useApprovePauLearning();
  const discard = useDiscardPauLearning();
  const removeDoc = useRemovePauDocument();
  const [editing, setEditing] = useState<PauPendingItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const storeName = (id: string | null) => (id ? (stores.find((s) => s.id === id)?.name ?? "Tienda") : "Todas las tiendas");
  const pending = data.data?.pending ?? [];
  const documents = data.data?.documents ?? [];
  const learned = data.data?.learned ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Pau aprende de las ventas cerradas, de cómo las vendedoras resuelven objeciones y de los documentos del negocio. Nada
          llega a los clientes sin aprobación del administrador o la supervisora.
        </span>
      </div>
      {data.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Cargando" />}
      {data.isError && <p className="text-sm text-destructive">No se pudo cargar lo que Pau aprendió.</p>}
      {data.data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card id="pau-apr-pend" title="Por aprobar" subtitle={`${pending.length} pendiente${pending.length === 1 ? "" : "s"}`}>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
                <b className="text-foreground">Todo revisado</b>
              </div>
            ) : (
              <ul className="divide-y">
                {pending.map((p) => (
                  <li key={`${p.source}-${p.id}`} className="flex gap-3 py-3 first:pt-0" data-testid="pau-pending">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          {p.type === "Pregunta sin respuesta" ? "Pregunta sin respuesta oficial" : p.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {storeName(p.storeId)} · {p.origin}
                        </span>
                      </div>
                      <b className="mt-1.5 block text-sm">«{p.question}»</b>
                      {p.answer ? (
                        <p className="mt-1 border-l-2 border-primary/40 pl-2 text-sm text-muted-foreground">{p.answer}</p>
                      ) : (
                        <p className="mt-1 text-sm text-amber-700">No hay respuesta oficial. Escríbela para que Pau la use.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Button
                        size="sm"
                        disabled={!p.answer || approve.isPending}
                        onClick={() => approve.mutate({ source: p.source, id: p.id })}
                      >
                        Aprobar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        {p.answer ? "Editar" : "Responder"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={discard.isPending}
                        onClick={() => discard.mutate({ source: p.source, id: p.id })}
                      >
                        Descartar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="space-y-4">
            <Card
              id="pau-apr-docs"
              title="Documentos del negocio"
              action={
                <Button size="sm" variant="outline" onClick={() => setUploading(true)}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Subir
                </Button>
              }
            >
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sube políticas de cambio, tablas de medidas o preguntas frecuentes. Pau las lee y te propone respuestas.
                </p>
              ) : (
                <ul className="divide-y">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2 first:pt-0" data-testid="pau-doc">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{d.name}</b>
                        <small className="block text-xs text-muted-foreground">
                          {storeName(d.storeId)} · {shortDate(d.createdAt)}
                          {d.status === "proposed" && d.pending > 0 && ` · ${d.pending} por aprobar`}
                          {d.status === "failed" && d.error && ` · ${d.error}`}
                        </small>
                      </div>
                      <Badge variant={DOC_STATUS[d.status].variant}>
                        {d.status === "processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
                        {DOC_STATUS[d.status].label}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Quitar ${d.name}`}
                        disabled={removeDoc.isPending}
                        onClick={() => removeDoc.mutate(d.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card id="pau-apr-ok" title="Ya aprendido">
              {learned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no apruebas nada. Lo aprobado aparece aquí y Pau lo usa.</p>
              ) : (
                <ul className="divide-y">
                  {learned.map((l, i) => (
                    <li key={i} className="py-2 text-sm first:pt-0">
                      {l.question}
                      <small className="block text-xs text-muted-foreground">
                        {l.answer} · aprobó {l.by ?? "el negocio"} · {shortDate(l.at)}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
      <AnswerDialog item={editing} onClose={() => setEditing(null)} />
      <UploadDialog open={uploading} onClose={() => setUploading(false)} />
    </div>
  );
}
