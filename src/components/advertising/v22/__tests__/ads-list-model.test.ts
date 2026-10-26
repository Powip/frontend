import type { AdsRow } from "@/services/advertisingV22Service";
import { isActiveAd, lastSpendLabel, sortAdItems } from "../ads-list-model";
const ad = (id: string, status = "ACTIVE", date?: string, spend = "10") => ({
  row: {
    id,
    name: id,
    status,
    effectiveStatus: status,
    lastSpendAt: date,
    timeZone: "America/Lima",
    insights: { spend },
  } as AdsRow,
  state: "Rentable",
});
it("orders active rows before paused ones, then by latest positive spend", () => {
  const rows = [
    ad("paused", "PAUSED", "2026-10-25T15:00:00Z"),
    ad("old", "ACTIVE", "2026-10-23", "100"),
    ad("new", "ACTIVE", "2026-10-25T14:00:00Z"),
  ];
  expect(sortAdItems(rows, "recent", []).map((item) => item.row.id)).toEqual([
    "new",
    "old",
    "paused",
  ]);
  expect(sortAdItems(rows, "spend", []).map((item) => item.row.id)[0]).toBe("old");
  expect(isActiveAd(ad("inherited", "CAMPAIGN_PAUSED").row)).toBe(false);
  expect(
    isActiveAd({ ...ad("rejected").row, effectiveStatus: "DISAPPROVED", status: "ACTIVE" }),
  ).toBe(false);
});
it("formats hourly spend in the account timezone and keeps unknown spend unknown", () => {
  expect(
    lastSpendLabel(ad("today", "ACTIVE", "2026-10-25T15:40:00Z").row, undefined, "2026-10-25"),
  ).toBe("hoy 10:40");
  expect(
    lastSpendLabel(ad("local", "ACTIVE", "2026-10-25T10:00:00").row, undefined, "2026-10-25"),
  ).toBe("hoy 10:00");
  expect(
    lastSpendLabel(ad("yesterday", "ACTIVE", "2026-10-25T00:40:00Z").row, undefined, "2026-10-25"),
  ).toBe("ayer");
  expect(lastSpendLabel(ad("missing").row, undefined, "2026-10-25")).toBe("—");
});
it("orders urgent statuses before profitable rows and uses spend within a status", () => {
  const low = ad("low", "ACTIVE", undefined, "10"),
    high = ad("high", "ACTIVE", undefined, "30");
  low.state = high.state = "Sin resultados";
  expect(
    sortAdItems([ad("profitable"), low, high], "attention", ["Sin resultados", "Rentable"]).map(
      (item) => item.row.id,
    ),
  ).toEqual(["high", "low", "profitable"]);
});
it("uses catalog destinations and actual Meta results without borrowing a sales channel", () => {
  const { catalogChannels } = require("../ads-list-model");
  const row = ad("local").row;
  expect([...catalogChannels({ ...row, destinationType: "WHATSAPP" })]).toEqual(["messages"]);
  expect([...catalogChannels({ ...row, destinationType: "WEBSITE" })]).toEqual(["web"]);
  expect([
    ...catalogChannels({
      ...row,
      destinations: [
        { type: "WHATSAPP", identifier: null },
        { type: "WEB", identifier: null },
      ],
    }),
  ]).toEqual(["messages", "web"]);
  expect([...catalogChannels({ ...row, objective: "OUTCOME_ENGAGEMENT" })]).toEqual(["other"]);
});
