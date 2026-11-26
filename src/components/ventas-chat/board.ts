import type { Board, Conversation, Pipeline, Stage } from "@/types/crm";

export const LOST_REASONS = [
  "Precio",
  "No respondió",
  "Sin stock",
  "Compró en otro lado",
  "Otro",
] as const;

/**
 * Mueve una conversación a otra etapa dentro de un tablero (función pura, para
 * la actualización optimista). Si no existe o ya está ahí, devuelve el mismo objeto.
 */
export function moveInBoard(
  board: Board,
  conversationId: string,
  toStageId: string,
  now = new Date(),
): Board {
  const from = board.columns.find((c) =>
    c.conversations.some((x) => x.id === conversationId),
  );
  const to = board.columns.find((c) => c.stage.id === toStageId);
  if (!from || !to || from.stage.id === to.stage.id) return board;
  const card = from.conversations.find((x) => x.id === conversationId)!;
  const moved: Conversation = {
    ...card,
    stageId: toStageId,
    stageChangedAt: now.toISOString(),
  };
  return {
    ...board,
    columns: board.columns.map((c) => {
      if (c.stage.id === from.stage.id) {
        return {
          ...c,
          total: Math.max(c.total - 1, 0),
          conversations: c.conversations.filter((x) => x.id !== conversationId),
        };
      }
      if (c.stage.id === to.stage.id) {
        return { ...c, total: c.total + 1, conversations: [moved, ...c.conversations] };
      }
      return c;
    }),
  };
}

export function findStage(pipelines: Pipeline[] | undefined, stageId: string): Stage | undefined {
  for (const p of pipelines ?? []) {
    const s = p.stages.find((x) => x.id === stageId);
    if (s) return s;
  }
  return undefined;
}

/** Texto final del motivo de pérdida: «Otro» usa el texto libre. */
export function buildLostReason(choice: string, other: string): string {
  return choice === "Otro" ? other.trim() : choice;
}
