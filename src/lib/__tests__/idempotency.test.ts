import { IDEMPOTENCY_HEADER, writeConfigArgs } from "../idempotency";

// FEAT-24 H6-D — opciones de escritura de la cola: el header solo con la
// bandera (ms-ventas y ms-products todavía no lo aceptan en CORS).

describe("writeConfigArgs", () => {
  const original = process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER;
    else process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER = original;
  });

  it("sin opciones no agrega nada (la llamada de escritorio queda igual)", () => {
    expect(writeConfigArgs()).toEqual([]);
  });

  it("con la bandera apagada manda solo el timeout", () => {
    delete process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER;
    expect(writeConfigArgs({ idempotencyKey: "k-1", timeoutMs: 15_000 })).toEqual([{ timeout: 15_000 }]);
    expect(writeConfigArgs({ idempotencyKey: "k-1" })).toEqual([]);
  });

  it("con NEXT_PUBLIC_IDEMPOTENCY_HEADER=on manda el header Idempotency-Key", () => {
    process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER = "on";
    expect(writeConfigArgs({ idempotencyKey: "k-1", timeoutMs: 15_000 })).toEqual([
      { timeout: 15_000, headers: { [IDEMPOTENCY_HEADER]: "k-1" } },
    ]);
  });
});
