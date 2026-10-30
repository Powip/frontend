import { WHATSAPP_TAB_STORAGE_KEY } from "../../constants/whatsapp-tabs";
import {
  parseWhatsAppTab,
  readStoredWhatsAppTab,
  resolveWhatsAppTab,
  writeStoredWhatsAppTab,
} from "../whatsapp-tab.util";

describe("parseWhatsAppTab", () => {
  it("acepta solo las seis pestañas", () => {
    expect(parseWhatsAppTab("historial")).toBe("historial");
    expect(parseWhatsAppTab("ajustes")).toBe("ajustes");
    expect(parseWhatsAppTab("Historial")).toBeNull();
    expect(parseWhatsAppTab("__proto__")).toBeNull();
    expect(parseWhatsAppTab("")).toBeNull();
    expect(parseWhatsAppTab(null)).toBeNull();
  });
});

describe("resolveWhatsAppTab", () => {
  it("prioriza la URL sobre la preferencia guardada", () => {
    expect(resolveWhatsAppTab({ urlTab: "plantillas", storedTab: "historial" })).toBe("plantillas");
  });

  it("usa la preferencia si la URL no tiene pestaña o es inválida", () => {
    expect(resolveWhatsAppTab({ urlTab: null, storedTab: "historial" })).toBe("historial");
    expect(resolveWhatsAppTab({ urlTab: "inventada", storedTab: "historial" })).toBe("historial");
  });

  it("vuelve a Conexión si nada es válido", () => {
    expect(resolveWhatsAppTab({ urlTab: "x", storedTab: "y" })).toBe("conexion");
  });
});

describe("preferencia guardada", () => {
  it("lee y escribe con la clave del módulo", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    writeStoredWhatsAppTab("programacion", storage);
    expect(store.get(WHATSAPP_TAB_STORAGE_KEY)).toBe("programacion");
    expect(readStoredWhatsAppTab(storage)).toBe("programacion");
  });

  it("ignora valores inválidos y errores del almacenamiento", () => {
    expect(readStoredWhatsAppTab({ getItem: () => "otra" })).toBeNull();
    expect(
      readStoredWhatsAppTab({
        getItem: () => {
          throw new Error("bloqueado");
        },
      }),
    ).toBeNull();
    expect(() =>
      writeStoredWhatsAppTab("historial", {
        setItem: () => {
          throw new Error("lleno");
        },
      }),
    ).not.toThrow();
  });
});
