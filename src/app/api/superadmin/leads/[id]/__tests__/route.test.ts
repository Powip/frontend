/**
 * @jest-environment node
 *
 * Tests: GET /api/superadmin/leads/:id trae las activaciones (FEAT-23 T16).
 * PostventaDetailModal dejó de leer `leads` + `lead_activations` con la anon key y usa esta ruta.
 */
import { createAdminClient } from "@/utils/supabase/admin";

jest.mock("@/utils/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const ID = "44444444-4444-4444-8444-444444444444";

describe("GET /api/superadmin/leads/:id", () => {
  let GET: any;
  beforeAll(async () => { ({ GET } = await import("../route")); });
  beforeEach(() => jest.resetAllMocks());

  it("pide activities y activations del lead y los devuelve", async () => {
    let selected = "";
    const lead = {
      id: ID,
      activities: [
        { id: "a1", created_at: "2026-01-01T00:00:00Z" },
        { id: "a2", created_at: "2026-02-01T00:00:00Z" },
      ],
      activations: [{ id: "act1", temp_password: "x" }],
    };
    const builder: any = {
      select: (cols: string) => { selected = cols; return builder; },
      eq: () => builder,
      single: () => Promise.resolve({ data: lead, error: null }),
    };
    (createAdminClient as jest.Mock).mockReturnValue({ from: () => builder });

    const res = await GET(new Request(`http://localhost/api/superadmin/leads/${ID}`), {
      params: Promise.resolve({ id: ID }),
    });

    expect(res.status).toBe(200);
    const flat = selected.replace(/\s+/g, "");
    expect(flat).toContain("activities:lead_activities(*)");
    expect(flat).toContain("activations:lead_activations(*)");
    const body = await res.json();
    expect(body.activations).toEqual([{ id: "act1", temp_password: "x" }]);
    expect(body.activities.map((a: any) => a.id)).toEqual(["a2", "a1"]);
  });
});
