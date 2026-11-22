"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Loader2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmEvents } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useBoard, useMoveCard, usePipelines } from "@/hooks/useCrmPlanning";
import type { AssignedFilter, BoardColumn, Conversation, Stage } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import LiveIndicator from "./LiveIndicator";
import LostReasonDialog from "./LostReasonDialog";
import PipelineEditorDialog from "./PipelineEditorDialog";
import { NATIVE_SELECT_CLASS, bandejaUrl, contactLabel, relativeTime } from "./format";

const ASSIGNED_OPTIONS: Array<{ value: AssignedFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "me", label: "Mías" },
  { value: "unassigned", label: "Sin asignar" },
];

interface CardProps {
  conversation: Conversation;
  stage: Stage;
  stages: Stage[];
  onOpen: (id: string) => void;
  onMove: (conversation: Conversation, stage: Stage) => void;
}

function CardBody({ conversation: c, stage, stages, onOpen, onMove }: CardProps) {
  const { phoneMasked } = useCrmMe();
  const name = contactLabel(c, phoneMasked);
  return (
    <>
      <button
        type="button"
        onClick={() => onOpen(c.id)}
        className="block w-full text-left"
        aria-label={`Abrir conversación de ${name}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{name}</span>
          {c.unreadCount > 0 && (
            <span
              aria-label={`${c.unreadCount} sin leer`}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
            >
              {c.unreadCount}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {c.lastMessagePreview ?? "Sin mensajes"}
        </span>
      </button>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span>{relativeTime(c.lastMessageAt) || "—"}</span>
        <span>· {c.assignedUserName ? c.assignedUserName : "Sin asignar"}</span>
      </p>
      {stage.kind === "lost" && c.lostReason && (
        <p className="mt-1 text-[11px] text-muted-foreground">Motivo: {c.lostReason}</p>
      )}
      <select
        aria-label={`Mover a… (${name})`}
        className={cn(NATIVE_SELECT_CLASS, "mt-2")}
        value=""
        onChange={(e) => {
          const target = stages.find((s) => s.id === e.target.value);
          if (target) onMove(c, target);
        }}
      >
        <option value="" disabled>
          Mover a…
        </option>
        {stages
          .filter((s) => s.id !== stage.id)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </>
  );
}

function Column({
  column,
  stages,
  onOpen,
  onMove,
}: {
  column: BoardColumn;
  stages: Stage[];
  onOpen: (id: string) => void;
  onMove: (conversation: Conversation, stage: Stage) => void;
}) {
  const { stage, total, conversations } = column;
  return (
    <section
      aria-label={`Etapa ${stage.name}`}
      className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
    >
      <header className="flex items-center gap-2 border-b p-2.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</h3>
        <Badge variant="secondary" aria-label={`${total} conversaciones`}>
          {total}
        </Badge>
      </header>
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "min-h-24 flex-1 space-y-2 overflow-y-auto p-2",
              snapshot.isDraggingOver && "bg-primary/5",
            )}
          >
            {conversations.map((c, index) => (
              <Draggable key={c.id} draggableId={c.id} index={index}>
                {(drag, dragSnapshot) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    {...drag.dragHandleProps}
                    data-testid="board-card"
                    className={cn(
                      "rounded-md border bg-card p-2.5 text-sm shadow-xs",
                      dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/40",
                    )}
                  >
                    <CardBody
                      conversation={c}
                      stage={stage}
                      stages={stages}
                      onOpen={onOpen}
                      onMove={onMove}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {conversations.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Sin conversaciones
              </p>
            )}
            {total > conversations.length && (
              <p className="text-center text-[11px] text-muted-foreground">
                Mostrando las {conversations.length} más recientes de {total}
              </p>
            )}
          </div>
        )}
      </Droppable>
    </section>
  );
}

/** Embudo de ventas (kanban): una columna por etapa, con arrastrar y «Mover a…». */
export default function EmbudoBoard() {
  const router = useRouter();
  const live = useCrmEvents();
  const pipelinesQuery = usePipelines();
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<AssignedFilter>("all");
  const { stores, phoneMasked } = useCrmMe();
  const [storeChoice, setStoreChoice] = useState("");
  const storeId = stores.some((s) => s.id === storeChoice) ? storeChoice : undefined;
  const [editing, setEditing] = useState(false);
  const [lostMove, setLostMove] = useState<{ conversation: Conversation; stage: Stage } | null>(
    null,
  );

  const pipelines = pipelinesQuery.data;
  const active =
    pipelines?.find((p) => p.id === pipelineId) ??
    pipelines?.find((p) => p.isDefault) ??
    pipelines?.[0];
  const boardQuery = useBoard(active?.id ?? null, assigned, storeId);
  const move = useMoveCard(active?.id ?? null, assigned, storeId);

  const board = boardQuery.data;
  const stages = board?.columns.map((c) => c.stage) ?? active?.stages ?? [];

  const requestMove = (conversation: Conversation, stage: Stage) => {
    if (conversation.stageId === stage.id) return;
    if (stage.kind === "lost") setLostMove({ conversation, stage });
    else move.mutate({ conversationId: conversation.id, stageId: stage.id });
  };

  const onDragEnd = (result: DropResult) => {
    const to = result.destination?.droppableId;
    if (!to || to === result.source.droppableId || !board) return;
    const conversation = board.columns
      .flatMap((c) => c.conversations)
      .find((c) => c.id === result.draggableId);
    const stage = stages.find((s) => s.id === to);
    if (conversation && stage) requestMove(conversation, stage);
  };

  const err = pipelinesQuery.isError
    ? crmError(pipelinesQuery.error)
    : boardQuery.isError
      ? crmError(boardQuery.error)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Embudo</span>
          <select
            aria-label="Embudo"
            className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
            value={active?.id ?? ""}
            onChange={(e) => setPipelineId(e.target.value)}
            disabled={!pipelines?.length}
          >
            {pipelines?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {stores.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Tienda</span>
            <select
              value={storeId ?? ""}
              onChange={(e) => setStoreChoice(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div role="group" aria-label="Asignación" className="flex gap-1">
          {ASSIGNED_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant={o.value === assigned ? "default" : "outline"}
              aria-pressed={o.value === assigned}
              onClick={() => setAssigned(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!pipelines}
          onClick={() => setEditing(true)}
        >
          <Settings2 /> Editar embudos
        </Button>
        <span className="ml-auto">
          <LiveIndicator state={live} />
        </span>
      </div>

      {(pipelinesQuery.isLoading || (boardQuery.isLoading && !board)) && !err && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando embudo…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (pipelinesQuery.isError ? pipelinesQuery.refetch() : boardQuery.refetch())}
          >
            Reintentar
          </Button>
        </div>
      )}

      {board && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex items-start gap-3 overflow-x-auto pb-2" data-testid="board">
            {board.columns.map((col) => (
              <Column
                key={col.stage.id}
                column={col}
                stages={stages}
                onOpen={(id) => router.push(bandejaUrl(id))}
                onMove={requestMove}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {lostMove && (
        <LostReasonDialog
          open
          contact={contactLabel(lostMove.conversation, phoneMasked)}
          onCancel={() => setLostMove(null)}
          onConfirm={(lostReason) => {
            move.mutate({
              conversationId: lostMove.conversation.id,
              stageId: lostMove.stage.id,
              lostReason,
            });
            setLostMove(null);
          }}
        />
      )}
      {pipelines && (
        <PipelineEditorDialog
          open={editing}
          onOpenChange={setEditing}
          pipelines={pipelines}
          activeId={active?.id ?? null}
          onSelect={setPipelineId}
        />
      )}
    </div>
  );
}
