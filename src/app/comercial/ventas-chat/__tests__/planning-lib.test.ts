import {
  fromLimaInput,
  groupTasks,
  toLimaInput,
} from "@/components/ventas-chat/agenda";
import { buildLostReason, moveInBoard } from "@/components/ventas-chat/board";
import type { Board, Conversation, Stage, Task } from "@/types/crm";

// 2026-11-19 15:00 en Lima (UTC-5) = 20:00 UTC
const NOW = new Date("2026-11-19T20:00:00.000Z");

const task = (id: string, dueAt: string): Task => ({
  id,
  conversationId: null,
  contactName: null,
  contactPhone: null,
  type: "other",
  title: id,
  note: null,
  dueAt,
  status: "pending",
  doneAt: null,
  assignedUserId: "u1",
  assignedUserName: "Jairo",
  createdByUserId: "u1",
  createdAt: "2026-11-01T00:00:00.000Z",
});

describe("groupTasks (hora Lima)", () => {
  it("separa vencidas, hoy y próximas, ordenadas por hora", () => {
    const g = groupTasks(
      [
        task("manana", "2026-11-20T15:00:00.000Z"),
        task("hoy-tarde", "2026-11-19T22:00:00.000Z"), // 17:00 Lima
        task("ayer", "2026-11-18T15:00:00.000Z"),
        task("hoy-temprano", "2026-11-19T14:00:00.000Z"), // 09:00 Lima, ya pasó
        task("hoy-noche", "2026-11-20T04:30:00.000Z"), // 23:30 Lima del 19 (en UTC ya es 20)
        task("medianoche", "2026-11-20T05:00:00.000Z"), // 00:00 Lima del 20
      ],
      NOW,
    );
    expect(g.overdue.map((t) => t.id)).toEqual(["ayer", "hoy-temprano"]);
    expect(g.today.map((t) => t.id)).toEqual(["hoy-tarde", "hoy-noche"]);
    expect(g.upcoming.map((t) => t.id)).toEqual(["medianoche", "manana"]);
  });

  it("lista vacía → grupos vacíos", () => {
    expect(groupTasks([], NOW)).toEqual({ overdue: [], today: [], upcoming: [] });
  });
});

describe("hora Lima en el campo de fecha", () => {
  it("convierte ISO ↔ datetime-local sin desfase", () => {
    expect(toLimaInput("2026-11-19T20:00:00.000Z")).toBe("2026-11-19T15:00");
    expect(toLimaInput("2026-11-20T04:30:00.000Z")).toBe("2026-11-19T23:30");
    expect(fromLimaInput("2026-11-19T15:00")).toBe("2026-11-19T20:00:00.000Z");
  });
});

const stage = (id: string, kind: Stage["kind"] = "open"): Stage => ({
  id,
  pipelineId: "p1",
  name: id,
  color: "#000000",
  position: 0,
  kind,
});
const conv = (id: string, stageId: string): Conversation =>
  ({ id, stageId, stageChangedAt: null }) as Conversation;
const board = (): Board => ({
  pipeline: { id: "p1", name: "Ventas", isDefault: true, stages: [stage("a"), stage("b")] },
  columns: [
    { stage: stage("a"), total: 2, conversations: [conv("c1", "a"), conv("c2", "a")] },
    { stage: stage("b"), total: 0, conversations: [] },
  ],
});

describe("moveInBoard", () => {
  it("mueve la tarjeta y ajusta los totales", () => {
    const out = moveInBoard(board(), "c1", "b", NOW);
    expect(out.columns[0].conversations.map((c) => c.id)).toEqual(["c2"]);
    expect(out.columns[0].total).toBe(1);
    expect(out.columns[1].conversations[0]).toMatchObject({
      id: "c1",
      stageId: "b",
      stageChangedAt: NOW.toISOString(),
    });
    expect(out.columns[1].total).toBe(1);
  });

  it("no cambia nada si ya está en esa etapa o no existe", () => {
    const b = board();
    expect(moveInBoard(b, "c1", "a")).toBe(b);
    expect(moveInBoard(b, "zzz", "b")).toBe(b);
    expect(moveInBoard(b, "c1", "zzz")).toBe(b);
  });
});

describe("buildLostReason", () => {
  it("«Otro» usa el texto libre", () => {
    expect(buildLostReason("Precio", "x")).toBe("Precio");
    expect(buildLostReason("Otro", "  se fue  ")).toBe("se fue");
    expect(buildLostReason("Otro", " ")).toBe("");
  });
});
