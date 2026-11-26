import { pendingNewTemplateFixture } from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { templateToEditInMeta } from "../TemplatesTab";

describe("«Guardar y reenviar a revisión»", () => {
  const approved = { ...pendingNewTemplateFixture, status: "APPROVED" as const };

  it("edita la misma plantilla si está aprobada, rechazada o pausada", () => {
    expect(templateToEditInMeta({ kind: "edit", template: approved })).toBe(approved);
    for (const status of ["REJECTED", "PAUSED"] as const) {
      const template = { ...approved, status };
      expect(templateToEditInMeta({ kind: "edit", template })).toBe(template);
    }
  });

  it("crea una nueva si es nueva, duplicada, borrador o está en revisión", () => {
    expect(templateToEditInMeta(undefined)).toBeNull();
    expect(templateToEditInMeta({ kind: "new" })).toBeNull();
    expect(templateToEditInMeta({ kind: "duplicate", template: approved })).toBeNull();
    for (const status of ["DRAFT", "PENDING"] as const) {
      expect(templateToEditInMeta({ kind: "edit", template: { ...approved, status } })).toBeNull();
    }
  });
});
