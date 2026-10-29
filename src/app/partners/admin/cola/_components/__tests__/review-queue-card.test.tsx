/**
 * Tests: ReviewQueueCard
 *
 * Comportamiento verificado:
 * 1. Un item "conflicto" muestra los botones "Rechazar" y "Asignar igual", y "Rechazar"
 *    llama a onResolve con resolution "rechazado".
 * 2. Un item "fraude" muestra "Bloquear" y "Es legítimo".
 * 3. Un item "revision" muestra "Aprobar" y "Rechazar".
 * 4. Un item "sin_conflicto" muestra solo "Aprobar".
 * 5. Un item ya resuelto (resolution !== "pendiente") no muestra ningún botón de acción,
 *    solo el badge de resolución.
 * 6. Los botones de acción se deshabilitan mientras isResolving es true.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewQueueCard } from "../review-queue-card";
import type { ReviewQueueItem } from "@/features/partners/models/review-queue-item";

function makeItem(overrides: Partial<ReviewQueueItem>): ReviewQueueItem {
  return {
    id: "queue-1",
    businessName: "Negocio Test",
    partnerName: "Partner Test",
    origin: "link",
    contact: "test@mail.com",
    kind: "conflicto",
    explanation: "explicación",
    note: null,
    resolution: "pendiente",
    ...overrides,
  };
}

describe("ReviewQueueCard", () => {
  it('"conflicto" muestra Rechazar/Asignar igual y Rechazar llama a onResolve con "rechazado"', async () => {
    const onResolve = jest.fn();
    const user = userEvent.setup();
    render(<ReviewQueueCard item={makeItem({ kind: "conflicto" })} isResolving={false} onResolve={onResolve} />);

    expect(screen.getByRole("button", { name: /rechazar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /asignar igual/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rechazar/i }));
    expect(onResolve).toHaveBeenCalledWith("queue-1", "rechazado");
  });

  it('"fraude" muestra Bloquear y Es legítimo', () => {
    render(<ReviewQueueCard item={makeItem({ kind: "fraude" })} isResolving={false} onResolve={jest.fn()} />);
    expect(screen.getByRole("button", { name: /bloquear/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /es legítimo/i })).toBeInTheDocument();
  });

  it('"revision" muestra Aprobar y Rechazar', () => {
    render(<ReviewQueueCard item={makeItem({ kind: "revision" })} isResolving={false} onResolve={jest.fn()} />);
    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rechazar/i })).toBeInTheDocument();
  });

  it('"sin_conflicto" muestra solo Aprobar', () => {
    render(<ReviewQueueCard item={makeItem({ kind: "sin_conflicto" })} isResolving={false} onResolve={jest.fn()} />);
    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rechazar/i })).not.toBeInTheDocument();
  });

  it("un item ya resuelto no muestra botones de acción", () => {
    render(
      <ReviewQueueCard
        item={makeItem({ kind: "conflicto", resolution: "rechazado" })}
        isResolving={false}
        onResolve={jest.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/rechazado/i)).toBeInTheDocument();
  });

  it("deshabilita los botones mientras isResolving es true", () => {
    render(<ReviewQueueCard item={makeItem({ kind: "sin_conflicto" })} isResolving={true} onResolve={jest.fn()} />);
    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeDisabled();
  });
});
