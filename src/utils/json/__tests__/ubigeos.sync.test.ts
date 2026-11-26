import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// FEAT-33 A8: el comprador y el servidor validan con la misma tabla de ubigeo de Core. ms-ventas guarda una copia
// (src/live/live-ubigeo.ts) con el blob de git de este archivo. Si cambias ubigeos.json, actualiza esa copia y
// este hash juntos.
const BACKEND_COPY_BLOB = "2c031082351126771a62dccfb98ac34d10f6537b";

test("ubigeos.json is the version copied into ms-ventas", () => {
  const content = readFileSync(join(__dirname, "..", "ubigeos.json"));
  const blob = createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
  expect(blob).toBe(BACKEND_COPY_BLOB);
});

test("has the 25 departments with all their provinces and districts", () => {
  const [{ departments }] = JSON.parse(readFileSync(join(__dirname, "..", "ubigeos.json"), "utf8"));
  const provinces = departments.flatMap((d: { provinces: unknown[] }) => d.provinces);
  const districts = provinces.flatMap((p: { districts: unknown[] }) => p.districts);
  expect([departments.length, provinces.length, districts.length]).toEqual([25, 196, 1892]);
});
