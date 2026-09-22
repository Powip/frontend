/**
 * Tests: getReferralTimeline
 *
 * Comportamiento verificado:
 * 1. Siempre devuelve 4 pasos (o 4 para "cancelado", con el último marcado "bad").
 * 2. "pagando" marca todos los pasos como "done" (el recorrido está completo).
 * 3. "en_revision" marca solo el primer paso como "active", el resto "pending".
 * 4. "activo_sin_pago" marca los primeros 3 pasos "done" y el 4to "active".
 * 5. "cancelado" marca los primeros 3 pasos "done" y agrega un paso final "bad".
 * 6. Los pasos posteriores al actual siempre son "pending", nunca "done" ni "active".
 */

import { getReferralTimeline } from "../referral-timeline";

describe("getReferralTimeline", () => {
  it('"pagando" marca todos los pasos como done', () => {
    const steps = getReferralTimeline("pagando");
    expect(steps).toHaveLength(5);
    expect(steps.every((step) => step.state === "done")).toBe(true);
  });

  it('"en_revision" marca el primer paso como active y el resto pending', () => {
    const steps = getReferralTimeline("en_revision");
    expect(steps[0].state).toBe("active");
    expect(steps.slice(1).every((step) => step.state === "pending")).toBe(true);
  });

  it('"activo_sin_pago" marca los primeros 3 pasos done y el 4to active', () => {
    const steps = getReferralTimeline("activo_sin_pago");
    expect(steps.slice(0, 3).every((step) => step.state === "done")).toBe(true);
    expect(steps[3].state).toBe("active");
    expect(steps[4].state).toBe("pending");
  });

  it('"cancelado" marca los primeros 3 pasos done y agrega un paso "bad" al final', () => {
    const steps = getReferralTimeline("cancelado");
    expect(steps).toHaveLength(4);
    expect(steps.slice(0, 3).every((step) => step.state === "done")).toBe(true);
    expect(steps[3].state).toBe("bad");
  });

  it("los pasos futuros nunca son done ni active", () => {
    const steps = getReferralTimeline("correo_enviado");
    const futureSteps = steps.slice(2);
    expect(futureSteps.every((step) => step.state === "pending")).toBe(true);
  });
});
