import { PANEL_TIME_ZONE } from "../../models/panel-period.model";
import { DEFAULT_PANEL_STATE } from "../../state/panel-state.model";
import { getClientTimeZone } from "../client-time-zone";
import { toZoneDayKey } from "../lima-time";
import { buildPanelQuery } from "../panel-query";
import { resolvePeriod } from "../period";

// 03:30 UTC: en Mendoza (UTC-3) ya es el 28; en Lima (UTC-5) todavía es la noche del 27.
const MADRUGADA_UTC = new Date("2026-10-28T03:30:00Z").getTime();
const hoy = { preset: "hoy", personalizado: null } as const;

describe("el periodo se cuenta en la zona horaria de quien consulta", () => {
  it("toZoneDayKey da el día calendario de cada zona", () => {
    expect(toZoneDayKey(MADRUGADA_UTC, "America/Lima")).toBe("2026-10-27");
    expect(toZoneDayKey(MADRUGADA_UTC, "America/Mendoza")).toBe("2026-10-28");
    expect(toZoneDayKey(MADRUGADA_UTC, "UTC")).toBe("2026-10-28");
    expect(toZoneDayKey(MADRUGADA_UTC, "Asia/Kolkata")).toBe("2026-10-28");
  });

  it("«Hoy» es el día de la zona enviada, y esa zona viaja en la consulta", () => {
    const lima = resolvePeriod(hoy, MADRUGADA_UTC);
    const mendoza = resolvePeriod(hoy, MADRUGADA_UTC, "America/Mendoza");
    expect(lima).toMatchObject({
      desde: "2026-10-27",
      hasta: "2026-10-27",
      zonaHoraria: "America/Lima",
    });
    expect(mendoza).toMatchObject({
      desde: "2026-10-28",
      hasta: "2026-10-28",
      hoy: "2026-10-28",
      zonaHoraria: "America/Mendoza",
    });
    const consulta = buildPanelQuery(DEFAULT_PANEL_STATE.filters, mendoza, null);
    expect(consulta).toMatchObject({ desde: "2026-10-28", zona_horaria: "America/Mendoza" });
  });

  it("sin zona explícita sigue siendo Lima (las pruebas no dependen de la máquina)", () => {
    expect(PANEL_TIME_ZONE).toBe("America/Lima");
    expect(resolvePeriod(hoy, MADRUGADA_UTC).zonaHoraria).toBe("America/Lima");
  });

  it("el mes actual y la comparación se arman con el «hoy» de esa zona", () => {
    const fin = new Date("2026-11-01T03:30:00Z").getTime(); // 1 nov (00:30) en Mendoza, 31 oct (22:30) en Lima
    const mes = { preset: "mes", personalizado: null } as const;
    expect(resolvePeriod(mes, fin).desde).toBe("2026-10-01");
    expect(resolvePeriod(mes, fin, "America/Mendoza").desde).toBe("2026-11-01");
  });
});

describe("getClientTimeZone", () => {
  const original = Intl.DateTimeFormat;
  afterEach(() => {
    Intl.DateTimeFormat = original;
  });

  it("usa la zona del navegador", () => {
    Intl.DateTimeFormat = (() => ({
      resolvedOptions: () => ({ timeZone: "America/Mendoza" }),
    })) as unknown as typeof Intl.DateTimeFormat;
    expect(getClientTimeZone()).toBe("America/Mendoza");
  });

  it("cae a Lima si el navegador no informa nada o falla", () => {
    Intl.DateTimeFormat = (() => ({
      resolvedOptions: () => ({ timeZone: undefined }),
    })) as unknown as typeof Intl.DateTimeFormat;
    expect(getClientTimeZone()).toBe("America/Lima");
    Intl.DateTimeFormat = (() => {
      throw new Error("sin Intl");
    }) as unknown as typeof Intl.DateTimeFormat;
    expect(getClientTimeZone()).toBe("America/Lima");
  });
});
