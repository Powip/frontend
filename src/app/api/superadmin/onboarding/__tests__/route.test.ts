/**
 * @jest-environment node
 *
 * Tests: GET /api/superadmin/onboarding?business_ids=... (FEAT-23 T16)
 * Reemplaza la lectura de onboarding_progress con la anon key desde PostventaTable.
 */
import { createAdminClient } from "@/utils/supabase/admin";

jest.mock("@/utils/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function mockSupabase(result: { data: unknown; error: unknown }) {
  const calls: { table?: string; select?: string; in?: [string, string[]] } = {};
  const builder: any = {
    select: (cols: string) => { calls.select = cols; return builder; },
    in: (col: string, vals: string[]) => { calls.in = [col, vals]; return Promise.resolve(result); },
  };
  (createAdminClient as jest.Mock).mockReturnValue({
    from: (table: string) => { calls.table = table; return builder; },
  });
  return calls;
}

const req = (qs: string) => new Request(`http://localhost/api/superadmin/onboarding${qs}`);

describe("GET /api/superadmin/onboarding", () => {
  let GET: (r: Request) => Promise<Response>;
  beforeAll(async () => { ({ GET } = await import("../route")); });
  beforeEach(() => jest.resetAllMocks());

  it("sin business_ids → [] y no consulta la base", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("descarta lo que no es UUID y los repetidos", async () => {
    const calls = mockSupabase({ data: [], error: null });
    const res = await GET(req(`?business_ids=${A},abc,${B},${A},1;drop`));
    expect(res.status).toBe(200);
    expect(calls).toEqual({ table: "onboarding_progress", select: "*", in: ["business_id", [A, B]] });
  });

  it("solo ids inválidos → [] sin consultar", async () => {
    const res = await GET(req("?business_ids=abc,123"));
    expect(await res.json()).toEqual([]);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("devuelve las filas de la base", async () => {
    const rows = [{ business_id: A, step_code: "store_config", completed: true }];
    mockSupabase({ data: rows, error: null });
    const res = await GET(req(`?business_ids=${A}`));
    expect(await res.json()).toEqual(rows);
  });

  it("error de la base → 500", async () => {
    mockSupabase({ data: null, error: { message: "permission denied" } });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req(`?business_ids=${A}`));
    expect(res.status).toBe(500);
  });
});
