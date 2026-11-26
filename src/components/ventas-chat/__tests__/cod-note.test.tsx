import { render, screen } from "@testing-library/react";
import CodNote, { codTeamText } from "../CodNote";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "co" } } }) }));
const kpis = jest.fn();
const agentes = jest.fn();
const plan = jest.fn();
jest.mock("@/hooks/useCcKpis", () => ({ useCcKpis: (...a: unknown[]) => kpis(...a) }));
jest.mock("@/hooks/useAgentes", () => ({ useAgentes: (...a: unknown[]) => agentes(...a) }));
jest.mock("@/hooks/useCrmPlan", () => ({ useCrmPlan: () => plan() }));

const agent = (nombre: string, ccActivo = true) => ({ id: nombre, nombre, email: null, ccActivo });

beforeEach(() => {
  kpis.mockReturnValue({ data: { por_confirmar: 3, contactado: 2, no_contesta: 1, confirmado: 9 } });
  agentes.mockReturnValue({ data: [agent("Milagros Ruiz"), agent("Diego Paz"), agent("Ana Sol", false)] });
  plan.mockReturnValue({ data: { accountType: "core" } });
});

describe("Aviso COD (B5)", () => {
  it("cuenta los COD que esperan llamada y nombra a quienes los gestionan", () => {
    render(<CodNote storeIds={["s1", "s2"]} />);
    const note = screen.getByTestId("cod-note");
    expect(note).toHaveTextContent("6 pedidos COD van a Gestión CC con Milagros y Diego");
    expect(screen.getByRole("link", { name: "Ver" })).toHaveAttribute("href", "/atencion-cliente");
    expect(kpis).toHaveBeenCalledWith("cod", ["s1", "s2"]);
    expect(agentes).toHaveBeenCalledWith(["s1", "s2"], "co");
  });

  it("no aparece en cuentas Solo CRM ni sin pedidos pendientes", () => {
    plan.mockReturnValue({ data: { accountType: "solo" } });
    const { unmount } = render(<CodNote storeIds={["s1"]} />);
    expect(screen.queryByTestId("cod-note")).not.toBeInTheDocument();
    expect(kpis).toHaveBeenLastCalledWith("cod", []);
    unmount();
    plan.mockReturnValue({ data: { accountType: "core" } });
    kpis.mockReturnValue({ data: { por_confirmar: 0, confirmado: 4 } });
    render(<CodNote storeIds={["s1"]} />);
    expect(screen.queryByTestId("cod-note")).not.toBeInTheDocument();
  });

  it("texto del equipo", () => {
    expect(codTeamText(["Milagros Ruiz"])).toBe("Milagros");
    expect(codTeamText(["Ana", "Luis", "Rosa", "Juan"])).toBe("Ana, Luis y 2 más");
    expect(codTeamText([])).toBe("");
  });
});
