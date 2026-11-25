"use client";
import { useState } from "react";
import { CheckCircle2, CircleHelp, Download, FileText, GraduationCap, Info, Loader2, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmError } from "@/services/crmService";
import {
  downloadPauTrainingDataset,
  getPauTrainingContent,
  type ExamCheck,
  type ExamReport,
  type PauTrainingVersion,
  type TrainingStatus,
} from "@/services/crmTrainingService";
import {
  useActivatePauTraining,
  useCompilePauTraining,
  useDeactivatePauTraining,
  useExamPauTraining,
  usePauTrainings,
} from "@/hooks/useCrmPauTraining";

export const TRAINING_STATUS: Record<
  TrainingStatus,
  { label: string; variant: "secondary" | "success" | "error" | "info" | "outline" }
> = {
  draft: { label: "Sin examinar", variant: "secondary" },
  passed: { label: "Aprobada", variant: "success" },
  failed: { label: "Reprobada", variant: "error" },
  active: { label: "Activa", variant: "info" },
  archived: { label: "Archivada", variant: "outline" },
};

export const CHECK_LABEL: Record<ExamCheck, string> = {
  one_question: "Una sola pregunta",
  ends_with_question: "Cierra con pregunta",
  no_invented_price: "Sin precios inventados",
  no_invented_scarcity: "Sin escasez inventada",
  no_cure_claim: "Sin promesas de cura",
  no_markdown: "Sin Markdown",
  no_prompt_leak: "No revela instrucciones",
  handoff: "Pasa a una persona",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function ExamResult({ exam }: { exam: ExamReport }) {
  return (
    <div className="space-y-2" data-testid="exam-result">
      <p className="text-sm">
        Reglas críticas: {exam.critical.total - exam.critical.failed} / {exam.critical.total} · Estilo:{" "}
        {Math.round(exam.style.rate * 100)} % (mínimo 80 %){exam.model ? ` · Modelo: ${exam.model}` : ""}
      </p>
      {(exam.unevaluated ?? 0) > 0 && (
        <p className="text-sm text-amber-700" data-testid="exam-unevaluated">
          {exam.unevaluated} caso{exam.unevaluated === 1 ? "" : "s"} no se pudo evaluar. Vuelve a rendir el examen.
        </p>
      )}
      <ul className="space-y-1.5">
        {exam.cases.map((c) => (
          <li key={c.caseId} className="rounded-md border p-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              {c.pass ? (
                <CheckCircle2 className="h-4 w-4 text-accent" aria-label="Aprobado" />
              ) : c.error ? (
                <CircleHelp className="h-4 w-4 text-amber-600" aria-label="No se pudo evaluar" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" aria-label="Reprobado" />
              )}
              {c.title}
            </div>
            {c.error ? (
              <p className="mt-1 text-amber-700" data-testid="case-unevaluated">
                No se pudo evaluar: {c.error}
              </p>
            ) : (
              <>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.answer || "(sin texto)"}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.checks.map((r) => (
                    <Badge key={r.check} variant={r.pass ? "success" : "error"}>
                      {CHECK_LABEL[r.check]}
                      {r.detail ? `: ${r.detail}` : ""}
                    </Badge>
                  ))}
                  {c.toolCalls.includes("pedir_ayuda_humana") && <Badge variant="info">Derivó a una persona</Badge>}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionRow({ v }: { v: PauTrainingVersion }) {
  const exam = useExamPauTraining();
  const activate = useActivatePauTraining();
  const [showExam, setShowExam] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const st = TRAINING_STATUS[v.status];
  const canExam = v.status === "draft" || v.status === "failed";
  const s = v.sources;

  const openText = async () => {
    try {
      setText((await getPauTrainingContent(v.id)).content);
    } catch (err) {
      toast.error(crmError(err).message);
    }
  };
  const download = async () => {
    try {
      await downloadPauTrainingDataset(v.id, v.version);
    } catch (err) {
      toast.error(crmError(err).message);
    }
  };

  return (
    <li className="space-y-2 rounded-md border p-3" data-testid={`training-v${v.version}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Versión {v.version}</span>
        <Badge variant={st.variant}>{st.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {fmt(v.createdAt)}
          {v.createdByName ? ` · ${v.createdByName}` : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {s.sheets} fichas · {s.objections} objeciones · {s.scriptSteps} pasos de guion
        {s.scriptSource === "methodology" ? " (guion base)" : s.scriptSource === "own" ? " (guion propio)" : ""}
        {s.storeScripts ? ` · ${s.storeScripts} tienda${s.storeScripts === 1 ? "" : "s"} con guion propio` : ""} · {s.policies} config. de tienda ·{" "}
        {s.photos} fotos
      </p>
      <div className="flex flex-wrap gap-2">
        {canExam && (
          <Button size="sm" onClick={() => exam.mutate(v.id)} disabled={exam.isPending}>
            {exam.isPending ? <Loader2 className="animate-spin" /> : <GraduationCap />}
            {exam.isPending ? "Rindiendo examen…" : "Rendir examen"}
          </Button>
        )}
        {v.status === "passed" && (
          <Button size="sm" onClick={() => activate.mutate(v.id)} disabled={activate.isPending}>
            {activate.isPending && <Loader2 className="animate-spin" />} Activar
          </Button>
        )}
        {v.exam && (
          <Button size="sm" variant="outline" onClick={() => setShowExam((x) => !x)}>
            {showExam ? "Ocultar examen" : "Ver examen"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={openText}>
          <FileText /> Ver texto
        </Button>
        <Button size="sm" variant="outline" onClick={download}>
          <Download /> Descargar JSONL
        </Button>
      </div>
      {exam.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Pau responde 13 casos con tu proveedor de IA. Puede tardar unos minutos.
        </p>
      )}
      {showExam && v.exam && <ExamResult exam={v.exam} />}
      <Dialog open={text !== null} onOpenChange={(o) => !o && setText(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Texto de la versión {v.version}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-xs">{text}</pre>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** Entrenamiento de Pau: metodología base + contenido de la empresa, examen y activación. */
export function PauTrainingSection() {
  const q = usePauTrainings();
  const compile = useCompilePauTraining();
  const deactivate = useDeactivatePauTraining();
  const data = q.data;

  return (
    <section aria-labelledby="pau-entrenamiento" className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="pau-entrenamiento" className="text-base font-semibold">
            Entrenamiento
          </h2>
          <p className="text-sm text-muted-foreground">
            Une la metodología de venta con tus fichas, objeciones, guion, tienda y fotos. Solo se activa si aprueba el
            examen.
          </p>
        </div>
        <Button onClick={() => compile.mutate(undefined)} disabled={compile.isPending || !data}>
          {compile.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Compilar versión
        </Button>
      </div>

      {q.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {crmError(q.error).message}
        </p>
      ) : !data ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : (
        <>
          <p role="note" className="flex items-start gap-2 rounded-md border bg-muted p-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Metodología base: {data.methodology.title} ({data.methodology.pages} páginas, {data.methodology.date}).{" "}
              {data.active
                ? `Pau usa la versión ${data.active.version}.`
                : "Sin versión activa: Pau usa la metodología base con tu contenido de hoy."}
            </span>
          </p>
          {data.outdated && (
            <p role="status" className="rounded-md border border-yellow-200 bg-yellow-100 p-2 text-sm text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300">
              Tu contenido cambió desde la versión activa. Compila una nueva versión para que Pau lo use.
            </p>
          )}
          {data.active && (
            <Button size="sm" variant="outline" onClick={() => deactivate.mutate(undefined)} disabled={deactivate.isPending}>
              Volver a la metodología base
            </Button>
          )}
          {data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay versiones. Compila la primera.</p>
          ) : (
            <ul className="space-y-2">
              {data.items.map((v) => (
                <VersionRow key={v.id} v={v} />
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            El JSONL sirve para un ajuste fino futuro con el proveedor que elijas. Hoy no se envía a ningún lado. Las
            propuestas de Pau sin aprobar no entran.
          </p>
        </>
      )}
    </section>
  );
}
