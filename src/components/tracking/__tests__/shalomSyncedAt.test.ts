import { formatShalomSyncedAt } from "../shalomSyncedAt";

const NOW = Date.parse("2026-11-19T20:00:00.000Z");

describe("formatShalomSyncedAt", () => {
  it("sin fecha o fecha inválida no devuelve nada", () => {
    expect(formatShalomSyncedAt(undefined, NOW)).toBeNull();
    expect(formatShalomSyncedAt(null, NOW)).toBeNull();
    expect(formatShalomSyncedAt("", NOW)).toBeNull();
    expect(formatShalomSyncedAt("no-es-fecha", NOW)).toBeNull();
  });

  it("menos de 1 min: hace un momento", () => {
    expect(formatShalomSyncedAt("2026-11-19T19:59:40.000Z", NOW)).toBe(
      "Actualizado hace un momento",
    );
  });

  it("menos de 60 min: hace X min", () => {
    expect(formatShalomSyncedAt("2026-11-19T19:55:00.000Z", NOW)).toBe(
      "Actualizado hace 5 min",
    );
  });

  it("una hora o más: dd/mm hh:mm en hora de Lima (UTC-5)", () => {
    // 17:30Z = 12:30 en Lima
    expect(formatShalomSyncedAt("2026-11-19T17:30:00.000Z", NOW)).toBe(
      "Actualizado: 19/11 12:30",
    );
  });
});
