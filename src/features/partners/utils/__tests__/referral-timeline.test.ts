import { toReferralStatus } from "../../mappers/to-partner-referral";
import { REFERRAL_STATUSES } from "../../models/referral-status.enum";
import type { ReferralStatus } from "../../models/referral-status.enum";
import { getReferralTimeline } from "../referral-timeline";

describe("getReferralTimeline without an events history API", () => {
  const cases: [ReferralStatus, string][] = [
    ["registrado", "Registrado"],
    ["en_revision", "En revisión"],
    ["correo_enviado", "Invitación enviada"],
    ["cuenta_creada", "Cuenta creada"],
    ["activo_sin_pago", "Empresa creada"],
    ["pagando", "Pago calificado registrado"],
    ["cancelado", "Referido cancelado"],
    ["desconocido", "Estado no disponible"],
  ];

  it.each(cases)("%s returns only the current reported state", (status, label) => {
    const steps = getReferralTimeline(status);
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe(label);
    expect(steps[0].state).not.toBe("done");
    expect(JSON.stringify(steps)).not.toMatch(
      /Activó un plan|comisión activa|1er mes|recurrente|comisión detenida|se revirtió el pago/,
    );
  });

  it("covers every declared frontend status without an ordinal progression", () => {
    expect(cases.map(([status]) => status).sort()).toEqual([...REFERRAL_STATUSES].sort());
  });

  it("COMPANY_CREATED does not invent invitation, account, plan or payment events", () => {
    expect(getReferralTimeline(toReferralStatus("COMPANY_CREATED"))).toEqual([
      {
        label: "Empresa creada",
        description: "Este estado no confirma un plan ni un pago",
        state: "active",
      },
    ]);
  });

  it("QUALIFYING_PAYMENT reports no commission activation or inferred preceding events", () => {
    expect(getReferralTimeline(toReferralStatus("QUALIFYING_PAYMENT"))).toEqual([
      {
        label: "Pago calificado registrado",
        description: "Este estado no informa una comisión",
        state: "active",
      },
    ]);
  });

  it("an unknown backend state does not even invent a completed registration", () => {
    expect(getReferralTimeline(toReferralStatus("UNKNOWN_BACKEND_STATE"))).toEqual([
      {
        label: "Estado no disponible",
        description: "Todavía no podemos mostrar el estado reportado de este referido",
        state: "pending",
      },
    ]);
  });
});
