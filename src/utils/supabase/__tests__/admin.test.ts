/**
 * @jest-environment node
 *
 * FEAT-23 T16: el cliente admin solo funciona con la service role; ya no cae a la anon key.
 */
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../admin";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => ({ ok: true })) }));

describe("createAdminClient", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.clearAllMocks(); });

  it("sin SUPABASE_SERVICE_ROLE_KEY tira error aunque exista la anon key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("con la service role crea el cliente sin sesión", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    createAdminClient();
    expect(createClient).toHaveBeenCalledWith("https://x.supabase.co", "service", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });
});
