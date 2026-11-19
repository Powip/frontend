"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePipelineMutations } from "@/hooks/useCrmPlanning";
import type { Pipeline, Stage, StageKind } from "@/types/crm";
import ConfirmDialog from "./ConfirmDialog";
import { NATIVE_SELECT_CLASS } from "./format";

const KIND_LABEL: Record<StageKind, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
};
const DEFAULT_COLOR = "#6366f1";

function StageRow({
  stage,
  index,
  count,
  siblings,
  onSave,
  onMove,
  onDelete,
}: {
  stage: Stage;
  index: number;
  count: number;
  siblings: Stage[];
  onSave: (id: string, input: { name?: string; color?: string }) => void;
  onMove: (stage: Stage, target: Stage) => void;
  onDelete: (stage: Stage) => void;
}) {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const dirty = name.trim() !== stage.name || color !== stage.color;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <input
        type="color"
        aria-label={`Color de ${stage.name}`}
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-8 w-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
      />
      <Input
        aria-label={`Nombre de la etapa ${stage.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 min-w-32 flex-1"
        maxLength={60}
      />
      <Badge variant="secondary">{KIND_LABEL[stage.kind]}</Badge>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!dirty || !name.trim()}
        onClick={() => onSave(stage.id, { name: name.trim(), color })}
      >
        Guardar
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={`Subir ${stage.name}`}
        disabled={index === 0}
        onClick={() => onMove(stage, siblings[index - 1])}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={`Bajar ${stage.name}`}
        disabled={index === count - 1}
        onClick={() => onMove(stage, siblings[index + 1])}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label={`Eliminar etapa ${stage.name}`}
        onClick={() => onDelete(stage)}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** Editor de embudos y etapas. Los errores 409 del servicio salen como aviso. */
export default function PipelineEditorDialog({
  open,
  onOpenChange,
  pipelines,
  activeId,
  onSelect,
}: Props) {
  const m = usePipelineMutations();
  const pipeline = pipelines.find((p) => p.id === activeId) ?? pipelines[0];
  const [newPipeline, setNewPipeline] = useState("");
  const [newStage, setNewStage] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newKind, setNewKind] = useState<StageKind>("open");
  const [renameDraft, setRenameDraft] = useState<{ id: string; value: string } | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "pipeline"; pipeline: Pipeline } | { kind: "stage"; stage: Stage } | null
  >(null);

  const renameValue =
    pipeline && renameDraft?.id === pipeline.id ? renameDraft.value : (pipeline?.name ?? "");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar embudos</DialogTitle>
            <DialogDescription>
              Crea embudos y define sus etapas. Una etapa solo se elimina si no tiene conversaciones.
            </DialogDescription>
          </DialogHeader>

          <section aria-label="Embudos" className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Embudo a editar"
                className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
                value={pipeline?.id ?? ""}
                onChange={(e) => onSelect(e.target.value)}
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isDefault ? " (por defecto)" : ""}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Nuevo embudo"
                placeholder="Nombre del nuevo embudo"
                value={newPipeline}
                onChange={(e) => setNewPipeline(e.target.value)}
                className="h-8 min-w-40 flex-1"
                maxLength={60}
              />
              <Button
                type="button"
                size="sm"
                disabled={!newPipeline.trim() || m.create.isPending}
                onClick={() =>
                  m.create.mutate(newPipeline.trim(), { onSuccess: () => setNewPipeline("") })
                }
              >
                <Plus /> Crear embudo
              </Button>
            </div>
            {pipeline && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Nombre del embudo"
                  value={renameValue}
                  onChange={(e) => setRenameDraft({ id: pipeline.id, value: e.target.value })}
                  className="h-8 min-w-40 flex-1"
                  maxLength={60}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    !renameValue.trim() ||
                    renameValue.trim() === pipeline.name ||
                    m.rename.isPending
                  }
                  onClick={() =>
                    m.rename.mutate(
                      { id: pipeline.id, name: renameValue.trim() },
                      { onSuccess: () => setRenameDraft(null) },
                    )
                  }
                >
                  Renombrar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirm({ kind: "pipeline", pipeline })}
                >
                  <Trash2 /> Eliminar embudo
                </Button>
              </div>
            )}
          </section>

          {pipeline && (
            <section aria-label="Etapas" className="space-y-2">
              <h3 className="text-sm font-semibold">Etapas de «{pipeline.name}»</h3>
              <ul className="space-y-2">
                {pipeline.stages.map((s, i) => (
                  <StageRow
                    key={`${s.id}:${s.name}:${s.color}`}
                    stage={s}
                    index={i}
                    count={pipeline.stages.length}
                    siblings={pipeline.stages}
                    onSave={(id, input) => m.updateStage.mutate({ id, input })}
                    onMove={(stage, target) =>
                      m.updateStage.mutate({ id: stage.id, input: { position: target.position } })
                    }
                    onDelete={(stage) => setConfirm({ kind: "stage", stage })}
                  />
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <input
                  type="color"
                  aria-label="Color de la nueva etapa"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-8 w-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  aria-label="Nombre de la nueva etapa"
                  placeholder="Nueva etapa"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  className="h-8 min-w-32 flex-1"
                  maxLength={60}
                />
                <select
                  aria-label="Tipo de la nueva etapa"
                  className={cn(NATIVE_SELECT_CLASS, "w-auto")}
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as StageKind)}
                >
                  {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!newStage.trim() || m.addStage.isPending}
                  onClick={() =>
                    m.addStage.mutate(
                      {
                        pipelineId: pipeline.id,
                        input: { name: newStage.trim(), color: newColor, kind: newKind },
                      },
                      { onSuccess: () => setNewStage("") },
                    )
                  }
                >
                  <Plus /> Añadir etapa
                </Button>
              </div>
            </section>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "pipeline" ? "Eliminar embudo" : "Eliminar etapa"}
        description={
          confirm?.kind === "pipeline"
            ? `Se eliminará el embudo «${confirm.pipeline.name}». Solo es posible si no tiene conversaciones.`
            : confirm?.kind === "stage"
              ? `Se eliminará la etapa «${confirm.stage.name}». Solo es posible si no tiene conversaciones.`
              : ""
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "pipeline") m.remove.mutate(confirm.pipeline.id);
          else if (confirm?.kind === "stage") m.removeStage.mutate(confirm.stage.id);
          setConfirm(null);
        }}
      />
    </>
  );
}
