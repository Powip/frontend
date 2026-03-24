import { createServerClient } from "@supabase/ssr";

export function createRouteClient(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {}
      },
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    }
  );

  return supabase;
}
