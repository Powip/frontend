import fs from "fs";
import path from "path";

// FEAT-24 H0 — el módulo de inventario, productos, compras y proveedores se
// escribe en español neutro: sin voseo y sin "Talle"/"Remera" en textos fijos.
const ROOT = path.join(__dirname, "..");
const DIRECTORIES = [
  "app/inventario",
  "app/productos",
  "app/compras",
  "app/registrar-compra",
  "app/proveedores",
  "components/inventory",
  "components/products",
  "components/proveedores",
  "components/compras",
  "components/excel",
];
const FILES = [
  "components/modals/AdjustStockModal.tsx",
  "components/modals/ImportExcelModal.tsx",
  "components/modals/EditProductImageModal.tsx",
  "components/proveedores/DeleteProviderModal.tsx",
];
const VOSEO =
  /(^|[^\p{L}])(podés|tenés|querés|sabés|elegí|creá|descargá|revisá|ingresá|seleccioná|usá|utilizá|agregá|hacé|confirmá|intentá|probá|cargá|completá|asegurate|fijate|verificá|escribí|subí|mirá|esperá|guardá|editá|eliminá|buscá|asociá|registrá|vinculá|unificá|resolvé|corregí|arrastrá|recargá|ajustalo|Podés|Tenés|Elegí|Creá|Descargá|Revisá|Ingresá|Seleccioná|Usá|Utilizá|Agregá|Hacé|Confirmá|Intentá|Probá|Cargá|Completá|Verificá|Escribí|Subí|Mirá|Esperá|Guardá|Editá|Eliminá|Buscá|Asociá|Registrá|Vinculá|Unificá|Asegurate|Fijate)(?![\p{L}])/u;
const REGIONAL = /["'`>](Talle|Remera)(?![\p{L}])/u;

function listFiles(directory: string): string[] {
  const absolute = path.join(ROOT, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : listFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}

it("los textos del módulo no usan voseo ni regionalismos", () => {
  const files = [...new Set([...DIRECTORIES.flatMap(listFiles), ...FILES.filter((file) => fs.existsSync(path.join(ROOT, file)))])];
  const hits: string[] = [];
  for (const file of files) {
    fs.readFileSync(path.join(ROOT, file), "utf8").split("\n").forEach((line, index) => {
      if (VOSEO.test(line) || REGIONAL.test(line)) hits.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  expect(hits).toEqual([]);
});
