import {
  type AdvertisingLocalStorage,
  readAdvertisingLocalRecords,
} from "../advertising-local-records";

const COMPANY = "company-a";
const STORE = "store-a";
const UUID = "f5b227fe-f99f-459a-9efb-9ac1a3f9ec2f";
const identityKey = (companyId = COMPANY) => `powip:advertising:manual-browser:${companyId}`;
const pautaKey = (companyId = COMPANY) => `powip:admin:pauta:${companyId}`;
const cierreKey = (storeId = STORE) => `powip_cierre_dia_${storeId}`;

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: AdvertisingLocalStorage = {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
  return { storage, values };
}

function pauta(overrides: Record<string, unknown> = {}) {
  return {
    id: "pauta-1",
    canalId: "channel-a",
    fecha: "2026-10-08",
    monto: "100.50",
    lineas: [{ tipo: "gen", ref: "General del canal", monto: 100.5 }],
    ...overrides,
  };
}

function cierre(overrides: Record<string, unknown> = {}) {
  return {
    storeId: STORE,
    date: "2026-10-08",
    publiMeta: "10.0050",
    publiTiktok: 20.5,
    publiGoogle: null,
    ingreso: 1000,
    costo: 300,
    ...overrides,
  };
}

function read(initial: Record<string, string>, storeIds: string[] = [], offset = 0) {
  const memory = memoryStorage({ [identityKey()]: UUID, ...initial });
  return {
    ...readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds,
      storage: memory.storage,
      offset,
    }),
    ...memory,
  };
}

describe("advertising local manual records", () => {
  it("uses one Pauta amount and preserves its allocation lines without duplicating spend", () => {
    const original = pauta({
      monto: "100.5000",
      lineas: [
        { tipo: "prod", ref: "sku-1", monto: 70 },
        { tipo: "gen", ref: "General", monto: 30.5 },
      ],
    });
    const raw = JSON.stringify([original]);
    const { records, warnings, values, storage } = read({ [pautaKey()]: raw });

    expect(records).toEqual([
      {
        source: "pauta",
        browserKey: UUID,
        sourceId: "pauta-1",
        date: "2026-10-08",
        amount: "100.5000",
        currency: null,
        payload: { storageKey: pautaKey(), original },
      },
    ]);
    expect(warnings).toEqual([]);
    expect(values.get(pautaKey())).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("preserves exact strings and expands numeric scientific notation without rounding", () => {
    const inputs = [
      "90071992547409931234567890.0000000001",
      "0.0050",
      0.0000001,
      0.30000000000000004,
      100.5,
      0,
    ];
    const { records, warnings } = read({
      [pautaKey()]: JSON.stringify(
        inputs.map((monto, index) => pauta({ id: `row-${index}`, monto })),
      ),
    });

    expect(records.map((record) => record.amount)).toEqual([
      "90071992547409931234567890.0000000001",
      "0.0050",
      "0.0000001",
      "0.30000000000000004",
      "100.5",
      "0",
    ]);
    expect(warnings).toEqual([]);
  });

  it.each([null, undefined, "", "S/100", "1,50", "-1", "NaN", "1e3", false, -1, 1e20])(
    "keeps an unknown or unsafe amount %j separate from zero",
    (monto) => {
      const { records } = read({ [pautaKey()]: JSON.stringify([pauta({ monto })]) });

      expect(records).toHaveLength(1);
      expect(records[0].amount).toBeNull();
      expect(records[0].payload.original).toEqual(JSON.parse(JSON.stringify(pauta({ monto }))));
    },
  );

  it("does not infer currency from soles labels, symbols, channels, or the browser", () => {
    const { records } = read({
      [pautaKey()]: JSON.stringify([
        pauta({ id: "unknown", moneda: "PEN", label: "S/100", currency: "S/" }),
        pauta({ id: "explicit", currency: "USD" }),
      ]),
    });

    expect(records.map((record) => record.currency)).toEqual([null, "USD"]);
  });

  it("reads only this company and the explicitly supplied stores", () => {
    const { records, storage } = read(
      {
        [pautaKey()]: JSON.stringify([pauta()]),
        [pautaKey("company-b")]: JSON.stringify([pauta({ id: "private-company-b" })]),
        [cierreKey()]: JSON.stringify({ "2026-10-08": cierre() }),
        [cierreKey("store-b")]: JSON.stringify({ "2026-10-08": cierre({ storeId: "store-b" }) }),
      },
      [STORE, STORE],
    );

    expect(records).toHaveLength(4);
    expect(storage.getItem).toHaveBeenCalledTimes(3);
    expect(storage.getItem).toHaveBeenNthCalledWith(1, identityKey());
    expect(storage.getItem).toHaveBeenNthCalledWith(2, pautaKey());
    expect(storage.getItem).toHaveBeenNthCalledWith(3, cierreKey());
    expect(JSON.stringify(records)).not.toContain("private-company-b");
    expect(JSON.stringify(records)).not.toContain("store-b");
  });

  it("rejects foreign company and store metadata inside otherwise local keys", () => {
    const { records, warnings } = read(
      {
        [pautaKey()]: JSON.stringify([pauta({ companyId: "company-b" })]),
        [cierreKey()]: JSON.stringify({
          "2026-10-08": cierre({ storeId: "store-b" }),
          "2026-10-09": cierre({ date: "2026-10-09", companyId: "company-b" }),
        }),
      },
      [STORE],
    );

    expect(records).toEqual([]);
    expect(warnings).toEqual(["Se omitieron registros de otra empresa o tienda."]);
  });

  it("gives each closing platform an identity and retains the full original closing", () => {
    const original = cierre();
    const raw = JSON.stringify({ [original.date]: original });
    const { records, warnings, values } = read({ [cierreKey()]: raw }, [STORE]);

    expect(
      records.map(({ sourceId, amount, currency }) => ({ sourceId, amount, currency })),
    ).toEqual([
      { sourceId: "store-a:2026-10-08:meta", amount: "10.0050", currency: null },
      { sourceId: "store-a:2026-10-08:tiktok", amount: "20.5", currency: null },
      { sourceId: "store-a:2026-10-08:google", amount: null, currency: null },
    ]);
    expect(records[0].payload).toEqual({
      storageKey: cierreKey(),
      storeId: STORE,
      platform: "meta",
      original,
    });
    expect(values.get(cierreKey())).toBe(raw);
    expect(warnings).toEqual([]);
  });

  it("does not create missing closing platform fields as confirmed zero", () => {
    const original = { storeId: STORE, date: "2026-10-08", publiMeta: null };
    const { records } = read({ [cierreKey()]: JSON.stringify({ [original.date]: original }) }, [
      STORE,
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].amount).toBeNull();
  });

  it.each([
    "08/10/2026",
    "2026-2-01",
    "2026-02-29",
    "2026-04-31",
    "0000-01-01",
    "2026-10-08T00:00:00Z",
  ])("omits the ambiguous or invalid date %s instead of converting it", (fecha) => {
    const { records, warnings } = read({ [pautaKey()]: JSON.stringify([pauta({ fecha })]) });

    expect(records).toEqual([]);
    expect(warnings).toEqual(["Se omitieron registros sin una fecha válida."]);
  });

  it("accepts a real leap day and rejects closing date/key discrepancies", () => {
    const { records, warnings } = read(
      {
        [pautaKey()]: JSON.stringify([pauta({ fecha: "2024-02-29" })]),
        [cierreKey()]: JSON.stringify({ "2026-10-08": cierre({ date: "2026-10-09" }) }),
      },
      [STORE],
    );

    expect(records).toHaveLength(1);
    expect(records[0].date).toBe("2024-02-29");
    expect(warnings).toEqual(["Se omitieron registros sin una fecha válida."]);
  });

  it("contains corrupt JSON, wrong roots, and malformed entries without hiding a good store", () => {
    const { records, warnings } = read(
      {
        [pautaKey()]: "{broken JSON",
        [cierreKey()]: JSON.stringify({ "2026-10-08": cierre() }),
      },
      [STORE],
    );
    expect(records).toHaveLength(3);
    expect(warnings).toHaveLength(1);

    expect(read({ [pautaKey()]: JSON.stringify({ fecha: "2026-10-08" }) }).records).toEqual([]);
    expect(read({ [cierreKey()]: JSON.stringify([cierre()]) }, [STORE]).records).toEqual([]);
    const malformed = read({
      [pautaKey()]: JSON.stringify([null, false, [], pauta({ lineas: "invalid" }), pauta()]),
    });
    expect(malformed.records).toHaveLength(1);
    expect(malformed.warnings).toEqual(["Se omitieron registros dañados."]);
  });

  it("rejects dangerous nested keys without modifying prototypes or legacy values", () => {
    const malicious = JSON.parse('{"__proto__":{"polluted":true}}');
    const raw = JSON.stringify([pauta({ extra: malicious }), pauta({ id: "good" })]);
    const { records, warnings, values } = read({ [pautaKey()]: raw });

    expect(records.map((record) => record.sourceId)).toEqual(["good"]);
    expect(warnings).toEqual(["Se omitieron registros dañados."]);
    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(values.get(pautaKey())).toBe(raw);
  });

  it("omits duplicate source IDs without summing amounts or replacing the original", () => {
    const { records, warnings } = read({
      [pautaKey()]: JSON.stringify([pauta(), pauta({ monto: "200" })]),
    });

    expect(records).toHaveLength(1);
    expect(records[0].amount).toBe("100.50");
    expect(warnings).toEqual(["Se omitieron registros dañados."]);
  });

  it("limits each preview to 1000 and returns a cursor for the remaining records", () => {
    const { records, warnings, nextOffset, storage } = read({
      [pautaKey()]: JSON.stringify(
        Array.from({ length: 1001 }, (_, index) => pauta({ id: `row-${index}` })),
      ),
    });

    expect(records).toHaveLength(1000);
    expect(records[999].sourceId).toBe("row-999");
    expect(warnings).toEqual(["Hay más registros. Lee el siguiente grupo."]);
    expect(nextOffset).toBe(1000);
    const next = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [],
      storage,
      offset: nextOffset ?? 0,
    });
    expect(next.records.map((record) => record.sourceId)).toEqual(["row-1000"]);
    expect(next.nextOffset).toBeNull();
    expect(next.warnings).toEqual([]);
  });

  it("continues a closing in the middle of its platforms without duplicating source IDs", () => {
    const daily: Record<string, unknown> = {};
    for (let index = 0; index < 335; index += 1) {
      const date = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
      daily[date] = cierre({ date });
    }
    const { records, warnings, nextOffset, storage } = read(
      { [cierreKey()]: JSON.stringify(daily) },
      [STORE],
    );

    expect(records).toHaveLength(1000);
    expect(warnings).toContain("Hay más registros. Lee el siguiente grupo.");
    expect(nextOffset).toBe(1000);
    const next = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [STORE],
      storage,
      offset: nextOffset ?? 0,
    });
    expect(next.records).toHaveLength(5);
    expect(next.records[0].sourceId).toMatch(/:tiktok$/);
    expect(next.nextOffset).toBeNull();
    const allIds = [...records, ...next.records].map((record) => record.sourceId);
    expect(new Set(allIds).size).toBe(1005);
    expect(next.records.every((record) => record.browserKey === UUID)).toBe(true);
  });

  it("advances after a full window of invalid records even when the preview is empty", () => {
    const entries = Array.from({ length: 1250 }, (_, index) =>
      index < 1050 ? null : pauta({ id: `row-${index}` }),
    );
    const { records, warnings, nextOffset, storage } = read({
      [pautaKey()]: JSON.stringify(entries),
    });

    expect(records).toEqual([]);
    expect(nextOffset).toBe(1000);
    expect(warnings).toEqual([
      "Se omitieron registros dañados.",
      "Hay más registros. Lee el siguiente grupo.",
    ]);
    const next = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [],
      storage,
      offset: nextOffset ?? 0,
    });
    expect(next.records).toHaveLength(200);
    expect(next.records[0].sourceId).toBe("row-1050");
    expect(next.records[199].sourceId).toBe("row-1249");
    expect(next.nextOffset).toBeNull();
  });

  it("reads all pages in stable company and store order and keeps one browser identity", () => {
    const firstStore = "store-a";
    const secondStore = "store-z";
    const { storage, values } = memoryStorage({
      [pautaKey()]: JSON.stringify(
        Array.from({ length: 1998 }, (_, index) => pauta({ id: `row-${index}` })),
      ),
      [cierreKey(firstStore)]: JSON.stringify({ "2026-10-08": cierre({ storeId: firstStore }) }),
      [cierreKey(secondStore)]: JSON.stringify({ "2026-10-08": cierre({ storeId: secondStore }) }),
    });
    const originals = new Map(values);
    const first = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [secondStore, firstStore],
      storage,
    });
    const second = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [firstStore, secondStore],
      storage,
      offset: first.nextOffset ?? 0,
    });
    const third = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [secondStore, firstStore],
      storage,
      offset: second.nextOffset ?? 0,
    });

    expect(first.nextOffset).toBe(1000);
    expect(second.nextOffset).toBe(2000);
    expect(third.nextOffset).toBeNull();
    expect(second.records.at(-1)?.sourceId).toBe("store-a:2026-10-08:tiktok");
    expect(third.records.map((record) => record.sourceId)).toEqual([
      "store-a:2026-10-08:google",
      "store-z:2026-10-08:meta",
      "store-z:2026-10-08:tiktok",
      "store-z:2026-10-08:google",
    ]);
    const allRecords = [...first.records, ...second.records, ...third.records];
    expect(new Set(allRecords.map((record) => record.sourceId)).size).toBe(2004);
    expect(new Set(allRecords.map((record) => record.browserKey)).size).toBe(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    for (const [key, original] of originals) expect(values.get(key)).toBe(original);
  });

  it("counts damaged closing entries as omitted candidates so the cursor keeps progressing", () => {
    const entries: Record<string, unknown> = Object.fromEntries(
      Array.from({ length: 1000 }, (_, index) => [`0000-invalid-${index}`, null]),
    );
    entries["2026-10-08"] = cierre();
    const first = read({ [cierreKey()]: JSON.stringify(entries) }, [STORE]);

    expect(first.records).toEqual([]);
    expect(first.nextOffset).toBe(1000);
    expect(first.warnings).toEqual([
      "Se omitieron registros dañados.",
      "Hay más registros. Lee el siguiente grupo.",
    ]);
    const next = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [STORE],
      storage: first.storage,
      offset: first.nextOffset ?? 0,
    });
    expect(next.records).toHaveLength(3);
    expect(next.nextOffset).toBeNull();
    expect(next.warnings).toEqual([]);
  });

  it("does not reimport duplicate IDs that occur in later windows", () => {
    const entries = Array.from({ length: 1000 }, (_, index) => pauta({ id: `row-${index}` }));
    entries.push(pauta({ id: "row-0", monto: "200" }));
    const first = read({ [pautaKey()]: JSON.stringify(entries) });
    const second = readAdvertisingLocalRecords({
      companyId: COMPANY,
      storeIds: [],
      storage: first.storage,
      offset: first.nextOffset ?? 0,
    });

    expect(first.records).toHaveLength(1000);
    expect(second.records).toEqual([]);
    expect(second.nextOffset).toBeNull();
    expect(second.warnings).toEqual(["Se omitieron registros dañados."]);
  });

  it("returns no next cursor when a window ends exactly at the last candidate", () => {
    const { records, nextOffset, warnings } = read({
      [pautaKey()]: JSON.stringify(
        Array.from({ length: 1000 }, (_, index) => pauta({ id: `row-${index}` })),
      ),
    });

    expect(records).toHaveLength(1000);
    expect(nextOffset).toBeNull();
    expect(warnings).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid offset %j before reading or writing storage",
    (offset) => {
      const { storage } = memoryStorage();
      const result = readAdvertisingLocalRecords({
        companyId: COMPANY,
        storeIds: [],
        storage,
        offset,
      });

      expect(result).toEqual({
        records: [],
        warnings: ["No se pudo leer ese grupo de registros."],
        nextOffset: null,
      });
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it("returns no records when the requested cursor is past the last candidate", () => {
    const result = read({ [pautaKey()]: JSON.stringify([pauta()]) }, [], 1000);

    expect(result.records).toEqual([]);
    expect(result.nextOffset).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("measures payload bytes and bounds nesting, arrays, and raw source sizes", () => {
    let nested: unknown = "leaf";
    for (let index = 0; index < 15; index += 1) nested = { nested };
    const { records, warnings } = read({
      [pautaKey()]: JSON.stringify([
        pauta({ id: "utf8", note: "é".repeat(8200) }),
        pauta({ id: "depth", nested }),
        pauta({ id: "array", lineas: Array.from({ length: 257 }, () => ({ monto: 1 })) }),
        pauta(),
      ]),
    });

    expect(records.map((record) => record.sourceId)).toEqual(["pauta-1"]);
    expect(warnings).toEqual(["Se omitieron registros demasiado grandes."]);
    expect(read({ [pautaKey()]: "x".repeat(2 * 1024 * 1024 + 1) }).records).toEqual([]);
  });

  it("persists only a stable, distinct company browser identity and does not rewrite legacy data", () => {
    const original = JSON.stringify([pauta()]);
    const { storage, values } = memoryStorage({ [pautaKey()]: original });
    const first = readAdvertisingLocalRecords({ companyId: COMPANY, storeIds: [], storage });
    const again = readAdvertisingLocalRecords({ companyId: COMPANY, storeIds: [], storage });
    const other = readAdvertisingLocalRecords({ companyId: "company-b", storeIds: [], storage });

    expect(first.records[0].browserKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(first.records[0].browserKey).toBe(again.records[0].browserKey);
    expect(values.get(identityKey("company-b"))).not.toBe(first.records[0].browserKey);
    expect(other.records).toEqual([]);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(values.get(pautaKey())).toBe(original);
  });

  it("fails closed when identity persistence or storage access is blocked", () => {
    const blocked: AdvertisingLocalStorage = {
      getItem: jest.fn(() => {
        throw new Error("Storage denied");
      }),
      setItem: jest.fn(),
    };
    const quota: AdvertisingLocalStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error("Quota exceeded");
      }),
    };

    for (const storage of [blocked, quota]) {
      const { records, warnings } = readAdvertisingLocalRecords({
        companyId: COMPANY,
        storeIds: [STORE],
        storage,
      });
      expect(records).toEqual([]);
      expect(warnings).toEqual(["No se pudo guardar la identidad de este navegador."]);
    }
  });

  it("never replaces a corrupted identity, which could duplicate a previous import", () => {
    const { records, warnings, storage } = read({
      [identityKey()]: "invalid identity",
      [pautaKey()]: JSON.stringify([pauta()]),
    });

    expect(records).toEqual([]);
    expect(warnings).toEqual(["No se pudo guardar la identidad de este navegador."]);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe or absent tenant IDs before touching storage", () => {
    const { storage } = memoryStorage();
    for (const companyId of ["", "../company-b", "company:a", " company-a"]) {
      const result = readAdvertisingLocalRecords({ companyId, storeIds: [], storage });
      expect(result.records).toEqual([]);
      expect(result.warnings).toEqual(["No se pudo identificar la empresa o sus tiendas."]);
    }
    expect(
      readAdvertisingLocalRecords({ companyId: COMPANY, storeIds: ["../store-b"], storage })
        .records,
    ).toEqual([]);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
