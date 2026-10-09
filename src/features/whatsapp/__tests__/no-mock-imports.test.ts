import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  assertWhatsAppContractAvailable,
  isWhatsAppContractAvailable,
  WHATSAPP_CONTRACTS,
  type WhatsAppContractKey,
  WhatsAppContractUnavailableError,
} from "../constants/whatsapp-contracts";

const SRC = join(__dirname, "..", "..", "..");

const PRODUCTION_ROOTS = [
  join(SRC, "features", "whatsapp"),
  join(SRC, "components", "whatsapp"),
  join(SRC, "app", "configuracion", "whatsapp"),
];

const NETWORK_USAGE =
  /\baxios\b|\baxiosAuth\b|\bfetch\(|["'`]\/wa\/|NEXT_PUBLIC_API_WHATSAPP|from\s+["']@\/services\//;
const CONTRACT_ASSERTION = /assertWhatsAppContractAvailable\(\s*["'](\w+)["']\s*\)/g;
const HAS_CONTRACT_ASSERTION = new RegExp(CONTRACT_ASSERTION.source);

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

function isProductionFile(path: string): boolean {
  return (
    /\.(ts|tsx)$/.test(path) &&
    !path.split(sep).includes("__tests__") &&
    !/\.(test|spec|stories)\.(ts|tsx)$/.test(path)
  );
}

const files = PRODUCTION_ROOTS.flatMap(collectFiles).filter(isProductionFile);
const sources = new Map(files.map((path) => [path, readFileSync(path, "utf8")]));

describe("código de producción del módulo WhatsApp", () => {
  it("encuentra los archivos del módulo", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no importa fixtures ni mocks", () => {
    const offenders = files.filter((path) =>
      /from\s+["'](@\/mocks|[./]+mocks)(\/|["'])/.test(sources.get(path) ?? ""),
    );
    expect(offenders.map((path) => relative(SRC, path))).toEqual([]);
  });

  it("todo archivo que hace llamadas de red declara el contrato que usa", () => {
    const offenders = files.filter((path) => {
      const source = sources.get(path) ?? "";
      return NETWORK_USAGE.test(source) && !HAS_CONTRACT_ASSERTION.test(source);
    });
    expect(offenders.map((path) => relative(SRC, path))).toEqual([]);
  });

  it("solo se declaran contratos confirmados", () => {
    const unavailable: string[] = [];
    for (const [path, source] of sources) {
      for (const match of source.matchAll(CONTRACT_ASSERTION)) {
        const key = match[1];
        if (!(key in WHATSAPP_CONTRACTS)) {
          unavailable.push(`${relative(SRC, path)}: ${key} no existe`);
        } else if (!isWhatsAppContractAvailable(key as WhatsAppContractKey)) {
          unavailable.push(`${relative(SRC, path)}: ${key} no está confirmado`);
        }
      }
    }
    expect(unavailable).toEqual([]);
  });
});

describe("assertWhatsAppContractAvailable", () => {
  it("deja pasar contratos confirmados", () => {
    expect(() => assertWhatsAppContractAvailable("companyStores")).not.toThrow();
  });

  it("impide usar contratos propuestos o sin definir", () => {
    expect(() => assertWhatsAppContractAvailable("templates")).toThrow(
      WhatsAppContractUnavailableError,
    );
    expect(() => assertWhatsAppContractAvailable("serviceBaseUrl")).toThrow(/C-00.1/);
  });
});
