import type { AdvertisingSummaryV11 } from "@/services/advertisingV11Service";
import {
  advertisingStoreChannelTimeZone,
  compareAdvertisingStoreChannel,
} from "../advertising-store-channel-cost-model";
import { businessV11, summaryV11 } from "./advertising-v11-fixtures";

function fixture() {
  const summary = summaryV11();
  summary.storeId = "store-a";
  summary.channelDaily = [
    {
      date: summary.from,
      accountId: "account-a",
      storeId: "store-a",
      channelId: "channel-a",
      currency: "PEN",
      spend: "100.10000001",
      provisional: false,
      coverage: "complete",
    },
  ];
  summary.byAccount = [
    { accountId: "account-a", currency: "PEN", timeZone: "America/Lima" },
  ] as AdvertisingSummaryV11["byAccount"];
  const business = {
    ...businessV11(),
    storeId: "store-a",
    channelId: "channel-a",
  };
  const store = { ...business, channelId: "all" };
  return { summary: { ...summary, channelDaily: summary.channelDaily }, business, store };
}
it("compara gasto exacto y entregas sólo del mismo canal y tienda", () => {
  const { summary, business, store } = fixture();
  summary.channelDaily.push({
    ...summary.channelDaily[0],
    storeId: "store-b",
    spend: "9999",
  });
  summary.channelDaily.push({
    ...summary.channelDaily[0],
    channelId: "channel-b",
    spend: "8888",
  });
  const result = compareAdvertisingStoreChannel(summary, "channel-a", "PEN", business, store);
  expect(result).toEqual({
    spend: "100.10000001",
    deliveredCount: 10,
    deliveredCountStatus: "confirmed",
    costPerDelivered: "10.010000",
    reason: null,
  });
});
it.each(["from", "to", "storeId", "channelId", "timeZone"])(
  "bloquea %s distinto en el origen de ventas",
  (field) => {
    const { summary, business, store } = fixture();
    expect(
      compareAdvertisingStoreChannel(
        summary,
        "channel-a",
        "PEN",
        { ...business, [field]: "other" },
        store,
      ).costPerDelivered,
    ).toBeNull();
  },
);
it("bloquea fechas, moneda, provisionales y cobertura desconocidos", () => {
  const { summary, business, store } = fixture();
  for (const changed of [
    { ...business, basis: "created" as const },
    { ...business, coverage: { complete: false, reasons: [] } },
    {
      ...business,
      currencies: [{ ...business.currencies[0], currency: null }],
    },
  ]) {
    expect(
      compareAdvertisingStoreChannel(summary, "channel-a", "PEN", changed, store).costPerDelivered,
    ).toBeNull();
  }
  for (const changes of [
    { coverage: "partial" as const },
    { provisional: true },
    { date: "1999-01-01" },
  ]) {
    expect(
      compareAdvertisingStoreChannel(
        {
          ...summary,
          channelDaily: [{ ...summary.channelDaily[0], ...changes }],
        },
        "channel-a",
        "PEN",
        business,
        store,
      ).costPerDelivered,
    ).toBeNull();
  }
});
it("no reparte gastos ni entregas sin canal, ni inventa cero", () => {
  const { summary, business, store } = fixture();
  const unassigned = {
    ...summary,
    channelDaily: [...summary.channelDaily, { ...summary.channelDaily[0], channelId: null }],
  };
  expect(
    compareAdvertisingStoreChannel(unassigned, "channel-a", "PEN", business, store).reason,
  ).toBe("Hay gasto sin canal confirmado");
  expect(
    compareAdvertisingStoreChannel(summary, "channel-a", "PEN", business, {
      ...store,
      unknownChannelCount: 1,
    }).reason,
  ).toBe("Hay entregas sin canal confirmado");
  expect(
    compareAdvertisingStoreChannel(
      { ...summary, channelDaily: [] },
      "channel-a",
      "PEN",
      business,
      store,
    ).spend,
  ).toBeNull();
  expect(
    compareAdvertisingStoreChannel(summary, "channel-a", "PEN", business, {
      ...store,
      storeId: "store-b",
    }).costPerDelivered,
  ).toBeNull();
});
it("solo consulta una zona acreditada por todas las cuentas del canal", () => {
  const { summary } = fixture();
  expect(advertisingStoreChannelTimeZone(summary, "channel-a")).toBe("America/Lima");
  expect(advertisingStoreChannelTimeZone({ ...summary, byAccount: [] }, "channel-a")).toBeNull();
  const mixed = {
    ...summary,
    channelDaily: [...summary.channelDaily, { ...summary.channelDaily[0], accountId: "account-b" }],
    byAccount: [
      ...summary.byAccount,
      { ...summary.byAccount[0], accountId: "account-b", timeZone: "UTC" },
    ],
  };
  expect(advertisingStoreChannelTimeZone(mixed, "channel-a")).toBeNull();
});

it.each(["partial", "missing", "provisional", "channel-partial"] as const)(
  "conserva entregados confirmados cuando el gasto está %s, sin calcular el costo",
  (state) => {
    const { summary, business, store } = fixture();
    if (state === "partial") summary.currencies[0].coverage = "partial";
    if (state === "missing") {
      summary.currencies = [];
      summary.channelDaily = [];
    }
    if (state === "provisional") summary.channelDaily[0].provisional = true;
    if (state === "channel-partial") summary.channelDaily[0].coverage = "partial";

    const result = compareAdvertisingStoreChannel(summary, "channel-a", "PEN", business, store);
    expect(result).toMatchObject({
      deliveredCount: 10,
      deliveredCountStatus: "confirmed",
      spend: null,
      costPerDelivered: null,
    });
    expect(result.reason).toBe(
      state === "partial" || state === "missing"
        ? "Gasto por completar"
        : "Gasto del canal por confirmar",
    );
  },
);

it("identifica entregados parciales sin usarlos como denominador completo", () => {
  const { summary, business, store } = fixture();
  const result = compareAdvertisingStoreChannel(
    summary,
    "channel-a",
    "PEN",
    { ...business, coverage: { complete: false, reasons: ["missing-delivered-date"] } },
    store,
  );
  expect(result).toMatchObject({
    deliveredCount: 10,
    deliveredCountStatus: "partial",
    costPerDelivered: null,
    reason: "Entregas por completar",
  });
});

it.each(["from", "to", "storeId", "channelId", "source", "definition", "basis"])(
  "no muestra conteos cuyo %s no corresponde al canal y periodo consultados",
  (field) => {
    const { summary, business, store } = fixture();
    const result = compareAdvertisingStoreChannel(
      summary,
      "channel-a",
      "PEN",
      { ...business, [field]: "other" },
      store,
    );
    expect(result.deliveredCount).toBeNull();
    expect(result.deliveredCountStatus).toBeNull();
    expect(result.costPerDelivered).toBeNull();
  },
);

it("muestra cero entregados cuando se conoce, sin dividir entre cero", () => {
  const { summary, business, store } = fixture();
  const result = compareAdvertisingStoreChannel(
    summary,
    "channel-a",
    "PEN",
    { ...business, currencies: [{ ...business.currencies[0], deliveredCount: 0 }] },
    store,
  );
  expect(result).toMatchObject({
    deliveredCount: 0,
    deliveredCountStatus: "confirmed",
    costPerDelivered: null,
    reason: "Sin entregados comparables",
  });
});

it.each([undefined, null, -1, 1.5, "10", Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
  "no inventa un conteo a partir del valor inválido %s",
  (deliveredCount) => {
    const { summary, business, store } = fixture();
    const result = compareAdvertisingStoreChannel(
      summary,
      "channel-a",
      "PEN",
      {
        ...business,
        currencies: [{ ...business.currencies[0], deliveredCount: deliveredCount as number }],
      },
      store,
    );
    expect(result.deliveredCount).toBeNull();
    expect(result.costPerDelivered).toBeNull();
  },
);

it("no infiere ni combina la moneda de entregados ausentes o duplicados", () => {
  const { summary, business, store } = fixture();
  for (const currencies of [
    [],
    [{ ...business.currencies[0], currency: null }],
    [{ ...business.currencies[0], currency: "USD" }],
    [business.currencies[0], business.currencies[0]],
  ]) {
    const result = compareAdvertisingStoreChannel(
      summary,
      "channel-a",
      "PEN",
      { ...business, currencies },
      store,
    );
    expect(result.deliveredCount).toBeNull();
    expect(result.costPerDelivered).toBeNull();
  }
});

it("conserva solo el conteo del canal si falta el total de la tienda o su atribución", () => {
  const { summary, business, store } = fixture();
  for (const storeBusiness of [undefined, { ...store, unknownChannelCount: 1 }]) {
    const result = compareAdvertisingStoreChannel(
      summary,
      "channel-a",
      "PEN",
      business,
      storeBusiness,
    );
    expect(result.deliveredCount).toBe(10);
    expect(result.costPerDelivered).toBeNull();
  }
});
