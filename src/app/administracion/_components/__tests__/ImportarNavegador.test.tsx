import { fireEvent, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { type ApiFalsa, renderConServidor } from "../../_lib/__tests__/servidor-falso";
import { ImportarNavegador } from "../ImportarNavegador";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "c1" }, accessToken: "t" } }),
}));
jest.mock("@/api/Administracion", () => jest.requireActual("../../_lib/__tests__/servidor-falso").crearApiFalsa());
const servidor = jest.requireMock<ApiFalsa>("@/api/Administracion");

const poner = (clave: string, valor: unknown) => window.localStorage.setItem(clave, JSON.stringify(valor));

beforeEach(() => {
  window.localStorage.clear();
  servidor.__reiniciar();
  jest.mocked(toast.success).mockClear();
  jest.mocked(toast.error).mockClear();
  jest.mocked(toast.info).mockClear();
});

describe("ImportarNavegador", () => {
  it("sin datos en este navegador no muestra nada", () => {
    poner("powip:admin:metas:otra-empresa:2026", { ventasAnual: 100, profitAnual: null, margenObjetivoPct: null });
    const { container } = renderConServidor(<ImportarNavegador />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ofrece subir lo guardado, lo sube y deja la copia como respaldo en el navegador", async () => {
    poner("powip:admin:metas:c1:2026", { ventasAnual: 600000, profitAnual: null, margenObjetivoPct: null });
    poner("powip:admin:capital:c1", [{ id: "a", tipo: "Capital propio", descripcion: "Inicial", monto: 5000, tienda: "" }]);
    servidor.importarDatosLocales.mockResolvedValueOnce({
      importado: { metas: 1, objetivos: 0, capital: 1, cuentas: 0 },
      omitido: [],
    });
    renderConServidor(<ImportarNavegador />);

    expect(await screen.findByText(/Tienes datos de Administración guardados solo en este navegador/)).toBeInTheDocument();
    expect(screen.getByText(/1 año de metas · 1 registro de capital/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Subirlos al servidor" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Subirlos al servidor" })).not.toBeInTheDocument());
    expect(servidor.importarDatosLocales).toHaveBeenCalledWith({
      metas: [{ anio: 2026, ventasAnual: 600000, profitAnual: null, margenObjetivoPct: null }],
      objetivos: [],
      capital: [{ tipo: "capital_propio", descripcion: "Inicial", monto: 5000, tienda: null }],
      cuentas: [],
    });
    expect(window.localStorage.getItem("powip:admin:metas:c1:2026")).toBeNull();
    expect(window.localStorage.getItem("powip:admin:respaldo:metas:c1:2026")).not.toBeNull();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Subido: 1 año de metas · 1 registro de capital"));
  });

  it("si el servidor ya tenía datos de un tipo, avisa que ese no se subió", async () => {
    poner("powip:admin:cuentas-pagar:c1", [{ id: "1", concepto: "Proveedor", descripcion: "", monto: 90, vencimiento: "" }]);
    servidor.importarDatosLocales.mockResolvedValueOnce({
      importado: { metas: 0, objetivos: 0, capital: 0, cuentas: 0 },
      omitido: ["cuentas"],
    });
    renderConServidor(<ImportarNavegador />);
    fireEvent.click(await screen.findByRole("button", { name: "Subirlos al servidor" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(jest.mocked(toast.info).mock.calls[0][0]).toMatch(/cuentas.*ya tenía/);
  });

  it("si falla, el aviso sigue y no se toca el navegador", async () => {
    poner("powip:admin:objetivo-canal:c1:todos", { ventasDia: 500 });
    servidor.importarDatosLocales.mockRejectedValueOnce(
      Object.assign(new Error("500"), { response: { data: { message: "Base caída" } } }),
    );
    renderConServidor(<ImportarNavegador />);
    fireEvent.click(await screen.findByRole("button", { name: "Subirlos al servidor" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Base caída"));
    expect(screen.getByRole("button", { name: "Subirlos al servidor" })).toBeInTheDocument();
    expect(window.localStorage.getItem("powip:admin:objetivo-canal:c1:todos")).not.toBeNull();
  });
});
