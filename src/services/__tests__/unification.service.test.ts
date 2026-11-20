/**
 * Tests: unification.service (FEAT-24 H11) — el historial manda solo los
 * filtros con valor (la empresa sale del token, nunca se manda).
 */
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
import axiosAuth from "@/lib/axiosAuth";
import { UNIFICATION_HISTORY_EXPORT_LIMIT, listUnificationHistory } from "../unification.service";

const get = jest.mocked(axiosAuth.get);
const EMPTY = { data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } };

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(EMPTY);
});

describe("listUnificationHistory", () => {
  it("sin filtros manda página y límite por defecto", async () => {
    await listUnificationHistory({ page: 2 });
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/reconciliation-tasks\/history$/), { params: { page: 2, limit: 10 } });
  });

  it("manda fecha, correo y vía, recorta el correo y omite los vacíos", async () => {
    await listUnificationHistory({
      page: 1,
      limit: UNIFICATION_HISTORY_EXPORT_LIMIT,
      status: "confirmed",
      from: "2026-11-01T05:00:00.000Z",
      to: "2026-11-18T04:59:59.999Z",
      resolvedBy: " Ana@Fixture.invalid ",
      via: "bandeja",
    });
    expect(get.mock.calls[0][1]).toEqual({
      params: {
        page: 1,
        limit: 500,
        status: "confirmed",
        from: "2026-11-01T05:00:00.000Z",
        to: "2026-11-18T04:59:59.999Z",
        resolvedBy: "Ana@Fixture.invalid",
        via: "bandeja",
      },
    });

    await listUnificationHistory({ page: 1, resolvedBy: "  ", from: undefined });
    expect(get.mock.calls[1][1]).toEqual({ params: { page: 1, limit: 10 } });
    expect(JSON.stringify(get.mock.calls)).not.toContain("companyId");
  });
});
