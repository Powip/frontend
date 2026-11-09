import { getVendedores } from "@/services/agentesService";
import {
  DIAS_SIN_ACTIVIDAD_ASESORA,
  opcionesAsesoresRealSource,
} from "../sources/opciones-asesores.source";

jest.mock("@/services/agentesService", () => ({ getVendedores: jest.fn() }));

describe("opcionesAsesoresRealSource", () => {
  beforeEach(() => jest.mocked(getVendedores).mockReset());

  it("pide marcar a quien lleva 90 días sin actividad y conserva a todos en la lista", async () => {
    jest.mocked(getVendedores).mockResolvedValue([
      { id: "2", nombre: "Beto", email: "b@x.pe", inactiva: true },
      { id: "1", nombre: "Ana", email: null, inactiva: false },
      { id: "3", nombre: null, email: "sin-nombre@x.pe" },
    ]);

    const lista = await opcionesAsesoresRealSource.fetch({ empresaId: "emp-1" });

    expect(DIAS_SIN_ACTIVIDAD_ASESORA).toBe(90);
    expect(getVendedores).toHaveBeenCalledWith("emp-1", { marcarInactivosDias: 90 });
    // No se filtra: otras pantallas (metas, vista previa, chips) necesitan todos los nombres.
    expect(lista.map((a) => a.nombre)).toEqual(["Ana", "Beto", "sin-nombre@x.pe"]);
    expect(lista.find((a) => a.id === "2")?.inactiva).toBe(true);
    expect(lista.find((a) => a.id === "1")?.inactiva).toBe(false);
  });
});
