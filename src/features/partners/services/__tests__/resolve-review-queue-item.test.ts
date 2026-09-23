/**
 * Tests: resolveReviewQueueItem
 *
 * Comportamiento verificado:
 * 1. Actualiza la resolución del item indicado.
 * 2. No afecta a otros items de la cola.
 * 3. Lanza un error si el item no existe.
 */

import { resolveReviewQueueItem } from "../resolve-review-queue-item";
import { listReviewQueue, resetReviewQueueStore } from "../../mocks/review-queue.store";

describe("resolveReviewQueueItem", () => {
  beforeEach(() => {
    resetReviewQueueStore();
  });

  it("actualiza la resolución del item indicado", async () => {
    const result = await resolveReviewQueueItem("queue-boutique-sol", "rechazado");
    expect(result.resolution).toBe("rechazado");
  });

  it("no afecta a otros items de la cola", async () => {
    await resolveReviewQueueItem("queue-boutique-sol", "rechazado");
    const other = listReviewQueue().find((item) => item.id === "queue-mi-tienda-test");
    expect(other?.resolution).toBe("pendiente");
  });

  it("lanza un error si el item no existe", async () => {
    await expect(resolveReviewQueueItem("queue-inexistente", "aprobado")).rejects.toThrow();
  });
});
