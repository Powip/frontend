import { render, screen } from "@testing-library/react";
import AdvertisingPage from "../page";

const mockPeriodo = { fromDate: "2026-11-01", toDate: "2026-11-26", setPeriod: jest.fn() };
let mockQuery = "";
const mockV11 = jest.fn();
const mockLive = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => mockPeriodo,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "u1" }, company: { id: "c1", name: "Empresa", stores: [{ id: "s1" }] }, accessToken: "t" },
  }),
}));
jest.mock("../../_lib/periodo", () => ({
  ...jest.requireActual("../../_lib/periodo"),
  hoyLima: () => "2026-11-26",
}));
jest.mock("@/components/advertising/AdvertisingAssignedSpendV11", () => ({
  AdvertisingAssignedSpendV11: (props: { from: string; to: string }) => {
    mockV11(props);
    return null;
  },
}));
jest.mock("@/components/advertising/AdvertisingLivePanel", () => ({
  AdvertisingLivePanel: (props: { from: string; to: string; manualContent?: unknown }) => {
    mockLive(props);
    return props.manualContent ?? null;
  },
}));

beforeEach(() => {
  mockQuery = "";
  mockPeriodo.fromDate = "2026-11-01";
  mockPeriodo.toDate = "2026-11-26";
  mockPeriodo.setPeriod.mockReset();
  mockV11.mockReset();
  mockLive.mockReset();
});

const ultimo = (mock: jest.Mock) => mock.mock.calls[mock.mock.calls.length - 1][0];

describe("Inversión publicitaria", () => {
  it("si el periodo llega a hoy, los cocientes se piden hasta ayer y se avisa", () => {
    render(<AdvertisingPage />);
    expect(ultimo(mockV11)).toEqual({ from: "2026-11-01", to: "2026-11-25" });
    expect(ultimo(mockLive)).toMatchObject({ from: "2026-11-01", to: "2026-11-25", storeIds: ["s1"] });
    expect(screen.getByText("Publicidad hasta ayer: 1–25 nov 2026")).toBeInTheDocument();
  });

  it("también corta los días que todavía no pasaron", () => {
    mockPeriodo.toDate = "2026-11-30";
    render(<AdvertisingPage />);
    expect(ultimo(mockV11)).toEqual({ from: "2026-11-01", to: "2026-11-25" });
  });

  it("con «Hoy» pasa el periodo tal cual y explica que los cocientes quedan pendientes", () => {
    mockPeriodo.fromDate = "2026-11-26";
    mockPeriodo.toDate = "2026-11-26";
    render(<AdvertisingPage />);
    expect(ultimo(mockV11)).toEqual({ from: "2026-11-26", to: "2026-11-26" });
    expect(screen.getByText("Los cocientes quedan pendientes en este periodo")).toBeInTheDocument();
  });

  it("un periodo cerrado no se toca ni muestra aviso", () => {
    mockPeriodo.fromDate = "2026-10-01";
    mockPeriodo.toDate = "2026-10-31";
    render(<AdvertisingPage />);
    expect(ultimo(mockV11)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(screen.queryByText(/Publicidad hasta ayer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/quedan pendientes/)).not.toBeInTheDocument();
  });

  it("respeta ?from=&to= de la URL", () => {
    mockQuery = "from=2026-09-01&to=2026-09-30";
    render(<AdvertisingPage />);
    expect(mockPeriodo.setPeriod).toHaveBeenCalledWith("2026-09-01", "2026-09-30");
  });

  it("ya no ofrece el registro manual del navegador (se retiró en la Fase 3)", () => {
    render(<AdvertisingPage />);
    expect(ultimo(mockLive).manualContent).toBeUndefined();
    expect(screen.queryByText(/Registro manual/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver registros manuales" })).not.toBeInTheDocument();
  });
});
