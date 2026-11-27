/**
 * @jest-environment node
 *
 * Tests: POST /api/superadmin/businesses/:id/onboarding (FEAT-23 T16)
 * Reemplaza el insert de onboarding_progress con la anon key desde LeadActivationFlow.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import { INITIAL_ONBOARDING_STEPS } from "@/lib/superadminOnboardingSteps";

jest.mock("@/utils/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const ID = "33333333-3333-4333-8333-333333333333";

function mockSupabase(opts: {
  existing?: { step_code: string }[];
  readError?: unknown;
  insertError?: unknown;
}) {
  const inserted: any[][] = [];
  (createAdminClient as jest.Mock).mockReturnValue({
    from: (table: string) => {
      expect(table).toBe("onboarding_progress");
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            expect([col, val]).toEqual(["business_id", ID]);
            return Promise.resolve({ data: opts.existing ?? [], error: opts.readError ?? null });
          },
        }),
        insert: (rows: any[]) => {
          inserted.push(rows);
          return Promise.resolve({ error: opts.insertError ?? null });
        },
      };
    },
  });
  return inserted;
}

const call = (POST: any, id: string) =>
  POST(new Request(`http://localhost/api/superadmin/businesses/${id}/onboarding`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });

describe("POST /api/superadmin/businesses/:id/onboarding", () => {
  let POST: any;
  beforeAll(async () => { ({ POST } = await import("../route")); });
  beforeEach(() => jest.resetAllMocks());

  it("id que no es UUID → 400 sin tocar la base", async () => {
    const res = await call(POST, "no-es-uuid");
    expect(res.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("empresa sin pasos → crea los 6 iniciales", async () => {
    const inserted = mockSupabase({});
    const res = await call(POST, ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ created: 6 });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].map((r) => r.step_code)).toEqual([...INITIAL_ONBOARDING_STEPS]);
    expect(inserted[0][0]).toEqual({ business_id: ID, step_code: "business_profile", completed: false, completion_pct: 0 });
  });

  it("no duplica los pasos que ya existen", async () => {
    const inserted = mockSupabase({ existing: [{ step_code: "business_profile" }, { step_code: "first_order" }] });
    const res = await call(POST, ID);
    expect(await res.json()).toEqual({ created: 4 });
    expect(inserted[0].map((r) => r.step_code)).toEqual(["store_config", "inventory_init", "integrations", "final_training"]);
  });

  it("con todos los pasos creados → no inserta", async () => {
    const inserted = mockSupabase({ existing: INITIAL_ONBOARDING_STEPS.map((step_code) => ({ step_code })) });
    const res = await call(POST, ID);
    expect(await res.json()).toEqual({ created: 0 });
    expect(inserted).toHaveLength(0);
  });

  it("error al insertar → 500", async () => {
    mockSupabase({ insertError: { message: "boom" } });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(POST, ID);
    expect(res.status).toBe(500);
  });
});
