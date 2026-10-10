import { fireEvent, render, screen } from "@testing-library/react";
import { usePautaEntries, type PautaEntry } from "../../_lib/pautaStorage";
import ManualAdvertisingPage from "../ManualAdvertisingPage";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company-a" } } }),
}));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-10-01", toDate: "2026-10-31" }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));
jest.mock("../../_lib/pautaStorage", () => ({
  ...jest.requireActual("../../_lib/pautaStorage"),
  usePautaEntries: jest.fn(),
}));

it("preserves cents in a new general allocation without rewriting historical entries", () => {
  const original: PautaEntry = {
    id: "historical", canalId: "WHATSAPP", fecha: "2026-10-01", monto: 100.5,
    lineas: [{ tipo: "gen", ref: "General del canal", monto: 101 }],
  };
  const before = JSON.stringify(original);
  let entries = [original];
  const setEntries = jest.fn((update: PautaEntry[] | ((previous: PautaEntry[]) => PautaEntry[])) => {
    entries = typeof update === "function" ? update(entries) : update;
  });
  jest.mocked(usePautaEntries).mockReturnValue([entries, setEntries, true]);
  render(<ManualAdvertisingPage />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar inversión" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "100.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar inversión" }));
  expect(setEntries).toHaveBeenCalledTimes(1);
  expect(entries).toHaveLength(2);
  expect(entries[1]).toMatchObject({
    monto: 100.5,
    lineas: [{ tipo: "gen", ref: "General del canal", monto: 100.5 }],
  });
  expect(entries[0]).toBe(original);
  expect(JSON.stringify(original)).toBe(before);
});
